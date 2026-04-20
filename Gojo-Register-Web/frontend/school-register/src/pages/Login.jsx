import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config";

const isRegistererRole = (value) => {
  const role = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["registerer", "registrar", "register_office"].includes(role);
};

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const registerLink = "/register";

  const canSubmit = useMemo(() => !loading, [loading]);

  useEffect(() => {
    try {
      const storedRegistrar = JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}");
      if ((storedRegistrar.registrarId || storedRegistrar.adminId || storedRegistrar.userId) && storedRegistrar.schoolCode) {
        if (!storedRegistrar.role || isRegistererRole(storedRegistrar.role)) {
          navigate("/dashboard", { replace: true });
          return;
        }

        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      }
    } catch {
      localStorage.removeItem("registrar");
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
        const user = res.data.user || {};
        const registrar = res.data.registrar || {};
        const schoolCode = res.data.schoolCode || "";

        const registrarRole = user.role || "registerer";

        if (!isRegistererRole(registrarRole)) {
          localStorage.removeItem("registrar");
          localStorage.removeItem("admin");
          setError("Only users with role = registerer can login here");
          return;
        }

        const registrarData = {
          registrarId: registrar.registrarId || user.employeeId || user.userId || null,
          adminId: registrar.registrarId || user.employeeId || user.userId || null,
          userId: user.userId || null,
          name: user.name || "",
          username: user.username || username.trim(),
          role: registrarRole,
          profileImage: user.profileImage || "",
          employeeId: registrar.employeeId || user.employeeId || null,
          schoolCode,
        };

        localStorage.setItem("registrar", JSON.stringify(registrarData));
        localStorage.setItem("admin", JSON.stringify({
          adminId: registrarData.adminId,
          registrarId: registrarData.registrarId,
          userId: registrarData.userId,
          name: registrarData.name,
          username: registrarData.username,
          role: registrarData.role,
          profileImage: registrarData.profileImage,
          schoolCode: registrarData.schoolCode,
          employeeId: registrarData.employeeId,
        }));

        navigate("/dashboard", { replace: true });
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Login failed";
      localStorage.removeItem("registrar");
      localStorage.removeItem("admin");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-login-page">
      <div className="register-login-glow register-login-glow-left" aria-hidden="true" />
      <div className="register-login-glow register-login-glow-right" aria-hidden="true" />

      <div className="register-login-shell">
        <section className="register-login-hero">
          <span className="register-login-badge">Gojo Register Portal</span>
          <h1>Welcome, Registerer</h1>
          <p>
            Sign in to manage enrollment, academic year rollover, promotions, transfers, and student registration operations from one place.
          </p>
          <ul className="register-login-list">
            <li>Use your registerer username and password</li>
            <li>Only authorized registerer accounts can access this portal</li>
            <li>Need help? Contact the school admin or system supervisor</li>
          </ul>
        </section>

        <section className="register-login-card-wrap">
          <div className="register-login-card">
            <h2>Registerer Login</h2>
            <p className="register-login-sub">Use your register portal credentials to continue.</p>

            {error ? <p className="register-login-alert">{error}</p> : null}

            <form onSubmit={handleLogin} className="register-login-form" noValidate>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your registerer username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
                autoComplete="username"
                disabled={loading}
              />
              {fieldErrors.username ? (
                <p className="register-login-field-error">{fieldErrors.username}</p>
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
                <p className="register-login-field-error">{fieldErrors.password}</p>
              ) : null}

              <button type="submit" className="register-login-button" disabled={!canSubmit}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="register-login-footer">
              Don&apos;t have an account? <Link to={registerLink}>Register</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
