import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaSave, FaTrash } from "react-icons/fa";
import { BACKEND_BASE } from "../config";

export default function TeacherRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", password: "", email: "", phone: "", gender: "" });
  const [courses, setCourses] = useState([{ grade: "", section: "", subject: "" }]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const updateCourse = (index, field, value) => {
    setCourses((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addCourse = () => setCourses((prev) => [...prev, { grade: "", section: "", subject: "" }]);
  const removeCourse = (index) => {
    if (courses.length === 1) return;
    setCourses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const stored = JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
      const schoolCode = stored.schoolCode || "";

      if (!schoolCode) {
        setMessage("Missing schoolCode in session. Please login again.");
        setSubmitting(false);
        return;
      }

      const cleanCourses = courses.filter((c) => c.grade && c.section && c.subject);
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("courses", JSON.stringify(cleanCourses));
      fd.append("schoolCode", schoolCode);

      const res = await fetch(`${BACKEND_BASE}/register/teacher`, { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`Teacher registered. teacherId: ${data.teacherId || ""}`);
        setForm({ name: "", username: "", password: "", email: "", phone: "", gender: "" });
        setCourses([{ grade: "", section: "", subject: "" }]);
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
      <div className="auth-box" style={{ maxWidth: 820 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "black", cursor: "pointer", fontSize: 20, width: 10 }}>←</button>
          <h2 style={{ margin: 0 }}>Teacher Registration</h2>
        </div>

        {message && <div style={{ marginBottom: 12, color: message.startsWith("Teacher registered") ? "green" : "#b91c1c" }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Full name</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Full name" />

          <label style={labelStyle}>Username (optional)</label>
          <input name="username" value={form.username} onChange={handleChange} placeholder="Leave empty to auto-generate" />

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

          <h3 style={{ textAlign: "left", marginBottom: 10, fontWeight: 700, color: "#334155", fontSize: 18 }}>Course Assignments</h3>

          {courses.map((course, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <input placeholder="Grade" value={course.grade} onChange={(e) => updateCourse(index, "grade", e.target.value)} />
              <input placeholder="Section" value={course.section} onChange={(e) => updateCourse(index, "section", e.target.value)} />
              <input placeholder="Subject" value={course.subject} onChange={(e) => updateCourse(index, "subject", e.target.value)} />
              <button type="button" onClick={() => removeCourse(index)} style={{ padding: "10px 12px" }}>
                <FaTrash />
              </button>
            </div>
          ))}

          <button type="button" onClick={addCourse} style={{ marginBottom: 12 }}>
            <FaPlus style={{ marginRight: 8 }} /> Add Course
          </button>

          <button type="submit" disabled={submitting}>
            <FaSave style={{ marginRight: 8 }} />
            {submitting ? "Saving..." : "Register Teacher"}
          </button>
        </form>
      </div>
    </div>
  );
}
