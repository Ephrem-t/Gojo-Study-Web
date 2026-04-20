import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Login.css";
import { BACKEND_BASE } from "../config.js";

const isAdminRole = (value) => {
  const role = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["school_admins", "school_admin", "admin", "admins"].includes(role);
};

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const registerLink = "/register";

  const canSubmit = useMemo(() => {
    return !loading;
  }, [loading]);

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
    } catch (err) {
      localStorage.removeItem("admin");
    }
  }, [navigate]);

  const validate = () => {
    const nextErrors = {};
    const usernameValue = username.trim();
    const passwordValue = String(password || "");

    if (!usernameValue) {
      nextErrors.username = "Username is required.";
    }

    if (!passwordValue.trim()) {
      nextErrors.password = "Password is required.";
    } else if (passwordValue.length < 4) {
      nextErrors.password = "Password must be at least 4 characters.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);

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
        navigate("/dashboard", { replace: true });
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      localStorage.removeItem("admin");
      const backendMsg = err?.response?.data?.message;
      setError(backendMsg || "Login failed. Check server and credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-glow admin-login-glow-left" aria-hidden="true" />
      <div className="admin-login-glow admin-login-glow-right" aria-hidden="true" />

      <div className="admin-login-shell">
        <section className="admin-login-hero">
          <span className="admin-login-badge">Gojo Admin Portal</span>
          <h1>Welcome, Admin</h1>
          <p>
            Sign in to manage your school, monitor records, and control administrative operations from one place.
          </p>
          <ul className="admin-login-list">
            <li>Use your school admin username and password</li>
            <li>Only authorized school administrators can access this portal</li>
            <li>Need help? Contact the system supervisor or school support team</li>
          </ul>
        </section>

        <section className="admin-login-card-wrap">
          <div className="admin-login-card">
            <h2>Admin Login</h2>
            <p className="admin-login-sub">Use your admin credentials to continue.</p>

            {error ? <p className="admin-login-alert">{error}</p> : null}

            <form onSubmit={handleLogin} className="admin-login-form" noValidate>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your admin username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
                autoComplete="username"
                disabled={loading}
              />
              {fieldErrors.username ? (
                <p className="admin-login-field-error">{fieldErrors.username}</p>
              ) : null}

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }}
                autoComplete="current-password"
                disabled={loading}
              />
              {fieldErrors.password ? (
                <p className="admin-login-field-error">{fieldErrors.password}</p>
              ) : null}

              <button type="submit" className="admin-login-button" disabled={!canSubmit}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="admin-login-footer">
              Don&apos;t have an account? <Link to={registerLink}>Register</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;