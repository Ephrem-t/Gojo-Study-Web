import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config.js";

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
  const [schools, setSchools] = useState([]);
  const [schoolCode, setSchoolCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE}/api/schools`);
        const data = await res.json();
        const list = Array.isArray(data?.schools) ? data.schools : [];
        if (list.length > 0) {
          setSchools(list);
          setSchoolCode(list[0].code);
        } else {
          const fallback = [{ code: "ET-ORO-ADA-GMI", shortName: "GMI", name: "Guda Miju" }];
          setSchools(fallback);
          setSchoolCode(fallback[0].code);
        }
      } catch {
        const fallback = [{ code: "ET-ORO-ADA-GMI", shortName: "GMI", name: "Guda Miju" }];
        setSchools(fallback);
        setSchoolCode(fallback[0].code);
      }
    };

    loadSchools();
  }, []);

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
      formData.append("schoolCode", schoolCode);
      const selectedSchool = schools.find((s) => s.code === schoolCode);
      formData.append("schoolShortName", selectedSchool?.shortName || "GMI");
      if (profile) formData.append("profile", profile);

      const res = await fetch(`${BACKEND_BASE}/api/register`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setAssignedAdminId(data.registererId || data.adminId);
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
         <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: "none", width: "30px", border: "none", cursor: "pointer", fontSize: 20, color: "black", borderRadius: 4, marginLeft: "-300px", marginBottom: "10px" }}
          >
            ←
          </button>
        <h2 style={{ textAlign: "center", marginTop: "-50px" }}>Register</h2>
        {message && <div className="auth-message">{message}</div>}
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column" }}>
          <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <select
            value={schoolCode}
            onChange={e => setSchoolCode(e.target.value)}
            required
            style={{ marginBottom: "12px" }}
          >
            {schools.map((school) => (
              <option key={school.code} value={school.code}>
                {school.name} ({school.shortName})
              </option>
            ))}
          </select>
          <select value={gender} onChange={e => setGender(e.target.value)} required style={{ marginBottom: "12px" }}>
            <option value="">Select gender</option>
            <option value="Male">Male</option><option value="Female">Female</option>
            
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
          <b>Your username:</b> <span style={{ color: "green" }}>{assignedAdminId}</span>
        </div>)}
      
      </div>
    </div>
  );
}

export default Register;