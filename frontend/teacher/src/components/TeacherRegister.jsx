import React, { useState } from "react";

function TeacherRegister() {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    courses: [{ grade: "", section: "", subject: "" }],
  });

  const [message, setMessage] = useState("");

  const handleChange = (e, index = null) => {
    const { name, value } = e.target;

    if (index !== null) {
      const updatedCourses = [...formData.courses];
      updatedCourses[index][name] = value;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("http://127.0.0.1:5000/register/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Teacher registered successfully!");
        setFormData({
          name: "",
          username: "",
          password: "",
          courses: [{ grade: "", section: "", subject: "" }],
        });
      } else {
        setMessage(`Failed to register teacher: ${data.message}`);
      }
    } catch (err) {
      setMessage("Error connecting to server.");
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Teacher Registration</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>

        <div>
          <label>Username:</label>
          <input type="text" name="username" value={formData.username} onChange={handleChange} required />
        </div>

        <div>
          <label>Password:</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required />
        </div>

        <h3>Courses</h3>
        {formData.courses.map((course, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <input
              type="text"
              name="subject"
              placeholder="Subject"
              value={course.subject}
              onChange={(e) => handleChange(e, index)}
              required
            />
            <input
              type="text"
              name="grade"
              placeholder="Grade"
              value={course.grade}
              onChange={(e) => handleChange(e, index)}
              required
            />
            <input
              type="text"
              name="section"
              placeholder="Section"
              value={course.section}
              onChange={(e) => handleChange(e, index)}
              required
            />
            {formData.courses.length > 1 && (
              <button type="button" onClick={() => removeCourse(index)}>Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addCourse}>Add Course</button>

        <div style={{ marginTop: "20px" }}>
          <button type="submit">Register</button>
        </div>
      </form>

      {message && <p style={{ marginTop: "20px", color: "red" }}>{message}</p>}

      {/* LINK TO LOGIN */}
      <p style={{ marginTop: "20px" }}>
        Already have an account? <a href="/login">Go to Login</a>
      </p>
    </div>
  );
}

export default TeacherRegister;
