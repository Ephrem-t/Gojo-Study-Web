import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginTeacher } from "../api/teacherApi";

const TeacherLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
  e.preventDefault();
  setMessage(""); // reset previous message

  if (!username || !password) {
    setMessage("Please enter both username and password.");
    return;
  }

  try {
    const data = await loginTeacher(username, password);
    console.log("Data received in login handler:", data);

    if (data.success && data.teacher) {
      localStorage.setItem("teacher", JSON.stringify(data.teacher));
      navigate("/teacher/dashboard");
    } else {
      setMessage(data.message || "Login failed.");
    }
  } catch (err) {
    console.error("Unexpected error during login:", err);
    setMessage("Unexpected error. Check console.");
  }
};


  return (
    <div className="login-container" style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "10px" }}>
      <h2>Teacher Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" style={{ marginTop: "10px" }}>Login</button>
      </form>
      {message && <p style={{ color: "red" }}>{message}</p>}
      <p style={{ marginTop: "10px" }}>
        Don't have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
};

export default TeacherLogin;
