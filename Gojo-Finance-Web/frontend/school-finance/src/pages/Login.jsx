import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault(); // ✅ REQUIRED

  console.log("LOGIN CLICKED");

  try {
    const res = await axios.post(`${BACKEND_BASE}/api/login`, {
      username,
      password,
    });

    console.log("Backend response:", res.data);

    if (res.data.success) {
      // New API returns `user` and `finance` objects.
      const user = res.data.user || {};
      const finance = res.data.finance || {};
      const schoolCode = res.data.schoolCode || "";

      // Save finance-specific entry
      const financeData = {
        financeId: finance.financeId || null,
        adminId: finance.adminId || finance.financeId || null,
        userId: user.userId || null,
        name: user.name || "",
        profileImage: user.profileImage || "",
        employeeId: finance.employeeId || user.employeeId || null,
        schoolCode,
      };
      localStorage.setItem("finance", JSON.stringify(financeData));

      // Keep `admin` key for compatibility with other parts of the app
      const adminCompat = {
        adminId: finance.adminId || finance.financeId || null,
        userId: user.userId || null,
        name: user.name || "",
        profileImage: user.profileImage || "",
        schoolCode,
      };
      localStorage.setItem("admin", JSON.stringify(adminCompat));

      console.log("Saved finance, navigating now...");
      navigate("/dashboard");
    }
  } catch (err) {
    console.error("Login failed:", err);
  }
};


  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>

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

       <form onSubmit={handleLogin}>
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
