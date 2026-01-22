import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";

function Register() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [profile, setProfile] = useState(null);
  const [assignedAdminId, setAssignedAdminId] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setAssignedAdminId("");
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("password", password);
      formData.append("email", email);
      formData.append("gender", gender);
      formData.append("phone", phone);
      formData.append("title", title);
      if (profile) formData.append("profile", profile);

      const res = await fetch("http://127.0.0.1:5000/api/register", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setAssignedAdminId(data.adminId);
        setMessage("Registration successful.");
        setTimeout(() => navigate("/login"), 4000)
      } else {
        setMessage(data.message || "Registration failed");
      }
    } catch (err) {
      setMessage("Server error, try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Register</h2>
        {message && <div className="auth-message">{message}</div>}
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column" }}>
          <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <select value={gender} onChange={e => setGender(e.target.value)} required style={{ marginBottom: "12px" }}>
            <option value="">Select gender</option>
            <option value="Male">Male</option><option value="Female">Female</option>
            <option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
          </select>
          <input type="tel" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} required />
          <input type="text" placeholder="Title (e.g., Principal, ...)" value={title} onChange={e => setTitle(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <div style={{ marginBottom: "15px", textAlign: "center" }}>
            {profile && <img src={URL.createObjectURL(profile)} alt="Profile Preview" style={{ maxWidth: "120px", maxHeight: "120px", objectFit: "cover" }} />}
            <input type="file" accept="image/*" onChange={e => setProfile(e.target.files[0])} />
          </div>
          <button type="submit">Register</button>
        </form>
        {assignedAdminId && (<div className="auth-success" style={{ marginTop:12 }}>
          <b>Your adminId (username):</b> <span style={{ color: "green" }}>{assignedAdminId}</span>
        </div>)}
        <p>Already have an account? <Link to="/login">Login here</Link></p>
      </div>
    </div>
  );
}

export default Register;