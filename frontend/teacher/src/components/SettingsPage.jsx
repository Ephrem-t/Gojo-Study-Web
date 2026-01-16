import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import {
  FaHome,
  FaUsers,
  FaClipboardCheck,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaSearch,
  FaHandHoldingMedical, FaChalkboardTeacher, FaFacebookMessenger,
  FaCommentDots
} from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";


function SettingsPage() {


 const [teacher, setTeacher] = useState(null);
const [profileImage, setProfileImage] = useState("/default-profile.png");
const [name, setName] = useState("");
const [username, setUsername] = useState("");

  
  const [selectedFile, setSelectedFile] = useState(null);
  
    const [darkMode, toggleDarkMode] = useDarkMode();

 
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  
const teacherId = teacher?.userId;

    
const navigate = useNavigate();

useEffect(() => {
  const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
  if (!storedTeacher) {
    navigate("/login"); // redirect if not logged in
    return;
  }
  setTeacher(storedTeacher);
}, []);

 const handleLogout = () => {
    localStorage.removeItem("teacher"); // or "user", depending on your auth
    navigate("/login");
  };


useEffect(() => {
  if (teacher) {
    setProfileImage(teacher.profileImage || "/default-profile.png");
    setName(teacher.name || "");
    setUsername(teacher.username || "");
  }
}, [teacher]);





  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleProfileSubmit = async () => {
    if (!selectedFile) return alert("Select an image first.");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${teacher.userId}.json`,
          { profileImage: base64Image }
        );
        const updatedTeacher = { ...teacher, profileImage: base64Image };

        localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
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
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${teacher.userId}.json`,
        { name, username }
      );
      const updatedTeacher = { ...teacher, name, username };
      localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
      setTeacher(updatedTeacher);

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
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${teacher.userId}.json`,
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
              {/* Top Navbar */}
              <nav className="top-navbar">
                <h2>Gojo Dashboard</h2>
                <div className="nav-search">
                  <FaSearch className="search-icon" />
                  <input type="text" placeholder="Search Teacher and Student..." />
                </div>
                <div className="nav-right">
     
<div className="icon-circle"><FaBell size={24} /></div>
                  <div className="icon-circle"><FaFacebookMessenger /></div>
                  <Link className="icon-circle" to="/settings">
  <FaCog />
</Link>

                  
    
          <img src={teacher?.profileImage || "/default-profile.png"} />
    
                </div>
              </nav>
        
              <div className="google-dashboard">
                {/* Sidebar */}
                <div className="google-sidebar">
              {teacher && (
      <div className="sidebar-profile">
        <div className="sidebar-img-circle">
          <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
        </div>
        <h3>{teacher.name}</h3>
        <p>{teacher.username}</p>
      </div>
    )}
    
                  <div className="sidebar-menu">
                    <Link
                      className="sidebar-btn"
                      to="/dashboard"
                  
                    >
                      <FaHome /> Home
                    </Link>
                   
                    <Link className="sidebar-btn" to="/students">
                      <FaUsers /> Students
                    </Link>
                    <Link className="sidebar-btn" to="/admins" >
                      <FaUsers /> Admins
                    </Link>
                    <Link
                      className="sidebar-btn"
                      to="/parents"
                      
                    >
                      <FaChalkboardTeacher /> Parents
                    </Link>
                    <Link className="sidebar-btn" to="/marks">
                      <FaClipboardCheck /> Marks
                    </Link>
                    <Link className="sidebar-btn" to="/attendance">
                      <FaUsers /> Attendance
                    </Link>
                   <Link className="sidebar-btn" to="/schedule" >
                                                    <FaUsers /> Schedule
                                                  </Link>
                    <button className="sidebar-btn logout-btn" onClick={handleLogout}>
                      <FaSignOutAlt /> Logout
                    </button>
                  </div>
                </div>

        {/* MAIN */}
        
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
