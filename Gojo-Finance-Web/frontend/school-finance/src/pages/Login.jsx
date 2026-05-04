import React, { useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";
import { BACKEND_BASE } from "../config";

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
        const finance = res.data.finance || {};
        const schoolCode = res.data.schoolCode || "";

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

        const adminCompat = {
          adminId: finance.adminId || finance.financeId || null,
          userId: user.userId || null,
          name: user.name || "",
          profileImage: user.profileImage || "",
          schoolCode,
        };
        localStorage.setItem("admin", JSON.stringify(adminCompat));

        navigate("/dashboard", { replace: true });
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      const backendMsg = err?.response?.data?.message;
      setError(backendMsg || "Login failed. Check server and credentials.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="finance-login-page">
      <div className="finance-login-glow finance-login-glow-left" aria-hidden="true" />
      <div className="finance-login-glow finance-login-glow-right" aria-hidden="true" />

      <div className="finance-login-shell">
        <section className="finance-login-hero">
          <span className="finance-login-badge">Gojo Finance Portal</span>
          <h1>Welcome, Finance Team</h1>
          <p>
            Sign in to review payments, manage school financial records, and keep finance operations organized in one place.
          </p>
          <ul className="finance-login-list">
            <li>Use your finance username and password</li>
            <li>Access billing, records, and school finance workflows securely</li>
            <li>Need help? Contact your school administrator or system support</li>
          </ul>
        </section>

        <section className="finance-login-card-wrap">
          <div className="finance-login-card">
            <h2>Finance Login</h2>
            <p className="finance-login-sub">Use your finance credentials to continue.</p>

            {error ? <p className="finance-login-alert">{error}</p> : null}

            <form onSubmit={handleLogin} className="finance-login-form" noValidate>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your finance username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
                autoComplete="username"
                disabled={loading}
              />
              {fieldErrors.username ? (
                <p className="finance-login-field-error">{fieldErrors.username}</p>
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
                <p className="finance-login-field-error">{fieldErrors.password}</p>
              ) : null}

              <button type="submit" className="finance-login-button" disabled={!canSubmit}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="finance-login-footer">
              Don&apos;t have an account? <Link to={registerLink}>Register</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
