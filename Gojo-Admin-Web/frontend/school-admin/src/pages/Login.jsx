import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config.js";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(`${BACKEND_BASE}/api/login`, {
        username: username.trim(),
        password,
      });

      if (res.data.success) {
        const adminData = {
          adminId: res.data.adminId,
          userId: res.data.userId,
          name: res.data.name,
          username: res.data.username,
          schoolCode: res.data.schoolCode,
          profileImage: res.data.profileImage,
        };

        localStorage.setItem("admin", JSON.stringify(adminData));
        navigate("/dashboard");
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      const backendMsg = err?.response?.data?.message;
      setError(backendMsg || "Login failed. Check server and credentials.");
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>
        {error && <div className="auth-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Login</button>
        </form>


        <p>
          I don’t have an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
