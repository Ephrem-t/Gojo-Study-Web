import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSave } from "react-icons/fa";
import { BACKEND_BASE } from "../config";

export default function RegistererRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    schoolCode: "",
    name: "",
    password: "",
    email: "",
    phone: "",
    gender: "",
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      const res = await fetch(`${BACKEND_BASE}/register/registerer`, { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`Registerer created. Username: ${data.username || ""}`);
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      setMessage("Server error. Check console.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { textAlign: "left", marginBottom: 8, display: "block", fontWeight: 700, color: "#334155", fontSize: 13 };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "black", cursor: "pointer", fontSize: 20, width: 10 }}>←</button>
          <h2 style={{ margin: 0 }}>Registerer Account Registration</h2>
        </div>

        <p style={{ marginTop: 0, color: "#64748b" }}>
          Username is auto-generated in format: GSR_0001_26
        </p>

        {message && <div style={{ marginBottom: 12, color: message.startsWith("Registerer created") ? "green" : "#b91c1c" }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>School Code</label>
          <input name="schoolCode" value={form.schoolCode} onChange={handleChange} placeholder="e.g. TEST_SCHOOL" />

          <label style={labelStyle}>Full name</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Full name" />

          <label style={labelStyle}>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" />

          <label style={labelStyle}>Email</label>
          <input name="email" value={form.email} onChange={handleChange} placeholder="Email" />

          <label style={labelStyle}>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="+251..." />

          <label style={labelStyle}>Gender</label>
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <button type="submit" disabled={submitting}>
            <FaSave style={{ marginRight: 8 }} />
            {submitting ? "Saving..." : "Create Registerer Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
