import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config.js";

const isAdminRole = (value) => {
  const role = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["school_admins", "school_admin", "admin", "admins"].includes(role);
};

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
      if (storedAdmin.userId || storedAdmin.adminId) {
        if (isAdminRole(storedAdmin.role)) {
          navigate("/dashboard", { replace: true });
          return;
        }

        localStorage.removeItem("admin");
      }
    } catch (error) {
      localStorage.removeItem("admin");
    }
  }, [navigate]);

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
          role: res.data.role,
          schoolCode: res.data.schoolCode,
          profileImage: res.data.profileImage,
        };

        if (!isAdminRole(adminData.role)) {
          localStorage.removeItem("admin");
          setError("Only users with role = school_admins can login here");
          return;
        }

        localStorage.setItem("admin", JSON.stringify(adminData));
        navigate("/dashboard");
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      localStorage.removeItem("admin");
      const backendMsg = err?.response?.data?.message;
      setError(backendMsg || "Login failed. Check server and credentials.");
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Admin Login</h2>
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
