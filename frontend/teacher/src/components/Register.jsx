import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";

export default function Register() {
  const navigate = useNavigate();

  const gradeOptions = ["9", "10", "11", "12"];
  const sectionOptions = ["A", "B", "C"];
 const subjectOptions = {
  "9": [
    "Mathematics",
    "English",
    "Biology",
    "Physics",
    "Chemistry",
    "Geography",
    "History",
    "Civics",
    "ICT"
  ],
  "10": [
    "Mathematics",
    "English",
    "Biology",
    "Physics",
    "Chemistry",
    "Geography",
    "History",
    "Civics",
    "ICT"
  ],
  "11": [
    "Mathematics",
    "English",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Geography",
    "History"
  ],
  "12": [
    "Mathematics",
    "English",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Geography",
    "History"
  ],
};


  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    courses: [{ grade: "", section: "", subject: "" }],
  });
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");

  const handleChange = (e, index = null) => {
    const { name, value } = e.target;
    if (index !== null) {
      const updatedCourses = [...formData.courses];
      updatedCourses[index][name] = value;
      if (name === "grade") updatedCourses[index]["subject"] = "";
      setFormData({ ...formData, courses: updatedCourses });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addCourse = () => {
    setFormData({
      ...formData,
      courses: [...formData.courses, { grade: "", section: "", subject: "" }],
    });
  };

  const removeCourse = (index) => {
    const updatedCourses = formData.courses.filter((_, i) => i !== index);
    setFormData({ ...formData, courses: updatedCourses });
  };


const hasDuplicateCourse = () => {
  const seen = new Set();

  for (let c of formData.courses) {
    if (!c.grade || !c.section || !c.subject) continue;

    const key = `${c.grade}${c.section}-${c.subject}`;

    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
};



  const handleRegister = async (e) => {
  e.preventDefault();
  setMessage("");

  // 🔴 FRONTEND VALIDATION
  if (hasDuplicateCourse()) {
    setMessage(
      "Duplicate subject detected! A subject can only be taught once per grade and section."
    );
    return;
  }

  try {
    const dataToSend = new FormData();
    dataToSend.append("name", formData.name);
    dataToSend.append("username", formData.username);
    dataToSend.append("password", formData.password);
    dataToSend.append("courses", JSON.stringify(formData.courses));
    if (profile) dataToSend.append("profile", profile);

    const res = await fetch("http://127.0.0.1:5000/register/teacher", {
      method: "POST",
      body: dataToSend,
    });

    const data = await res.json();

    if (data.success) {
      setFormData({
        name: "",
        username: "",
        password: "",
        courses: [{ grade: "", section: "", subject: "" }],
      });
      setProfile(null);
      navigate("/login");
    } else {
      setMessage(data.message || "Registration failed.");
    }
  } catch (err) {
    console.error("Registration error:", err);
    setMessage("Server error. Check console.");
  }
};


  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: "600px" }}>
        <h2>Teacher Registration</h2>
        {message && <p className="auth-error">{message}</p>}

        <form onSubmit={handleRegister}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div className="profile-upload">
            {profile && (
              <img
                src={URL.createObjectURL(profile)}
                alt="Profile Preview"
                className="profile-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfile(e.target.files[0])}
            />
          </div>

          <h3>Courses</h3>
          {formData.courses.map((course, index) => (
            <div className="course-group" key={index}>
              <select
                name="grade"
                value={course.grade}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Grade</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <select
                name="section"
                value={course.section}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Section</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                name="subject"
                value={course.subject}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={!course.grade}
              >
                <option value="">Select Subject</option>
                {course.grade && subjectOptions[course.grade].map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>

              {formData.courses.length > 1 && (
                <button type="button" className="remove-btn" onClick={() => removeCourse(index)}>Remove</button>
              )}
            </div>
          ))}

          <button type="button" className="add-btn" onClick={addCourse}>Add Course</button>
          <button type="submit" className="submit-btn">Register</button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Go to Login</Link>
        </p>
      </div>
    </div>
  );
}
