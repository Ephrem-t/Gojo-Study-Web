import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginTeacher } from "../api/teacherApi";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const registerLink = "/register";

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");


    
    const res = await loginTeacher(username, password);
    if (res.success) {
      localStorage.setItem("teacher", JSON.stringify(res.teacher));
      navigate("/dashboard");
    } else {
      setMessage(res.message || "Login failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Teacher Login</h2>
        <p className="subtle">Sign in to the teacher portal.</p>
        {message ? <p style={{ color: "#dc2626", marginBottom: "10px" }}>{message}</p> : null}

        <form onSubmit={handleLogin} className="vertical-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="submit-btn">Login</button>
        </form>

        <p>
          I don’t have an account? <Link to={registerLink}>Register</Link>
        </p>
      </div>
    </div>
  );
}
