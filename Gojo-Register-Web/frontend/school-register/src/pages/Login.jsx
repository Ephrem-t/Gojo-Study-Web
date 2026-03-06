import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError("");
      const res = await axios.post(`${BACKEND_BASE}/api/login`, {
        username,
        password,
      });

      if (res.data.success) {
        const user = res.data.user || {};
        const registrar = res.data.registrar || {};
        const schoolCode = res.data.schoolCode || "";

        const registrarData = {
          registrarId: registrar.registrarId || user.employeeId || user.userId || null,
          adminId: registrar.registrarId || user.employeeId || user.userId || null,
          userId: user.userId || null,
          name: user.name || "",
          profileImage: user.profileImage || "",
          employeeId: registrar.employeeId || user.employeeId || null,
          schoolCode,
        };

        localStorage.setItem("registrar", JSON.stringify(registrarData));
        localStorage.setItem("admin", JSON.stringify({
          adminId: registrarData.adminId,
          userId: registrarData.userId,
          name: registrarData.name,
          profileImage: registrarData.profileImage,
          schoolCode: registrarData.schoolCode,
        }));

        navigate("/dashboard");
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Login failed";
      setError(message);
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Registerer Login</h2>
        {error ? <p style={{ color: "#dc2626", marginBottom: "10px" }}>{error}</p> : null}

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
