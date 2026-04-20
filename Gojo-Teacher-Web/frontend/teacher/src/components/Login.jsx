import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginTeacher } from "../api/teacherApi";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const registerLink = "/register";

  const canSubmit = useMemo(() => {
    return !loading;
  }, [loading]);

  const schoolPrefix = useMemo(() => {
    const normalized = String(username || "").trim().toUpperCase();
    const lettersOnly = normalized.replace(/[^A-Z]/g, "");
    return lettersOnly.slice(0, 3);
  }, [username]);

  const validate = () => {
    const nextErrors = {};
    const usernameValue = username.trim();
    const passwordValue = String(password || "");

    if (!usernameValue) {
      nextErrors.username = "Username is required.";
    } else if (!/^[A-Za-z]{3}/.test(usernameValue)) {
      nextErrors.username = "Username must start with a 3-letter school code (example: GMI).";
    } else if (usernameValue.length < 6) {
      nextErrors.username = "Username looks too short.";
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
    setMessage("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await loginTeacher(username.trim(), password);

      if (res.success) {
        localStorage.setItem("teacher", JSON.stringify(res.teacher));
        navigate("/dashboard");
        return;
      }

      setMessage(res.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-login-page">
      <div className="teacher-login-glow teacher-login-glow-left" aria-hidden="true" />
      <div className="teacher-login-glow teacher-login-glow-right" aria-hidden="true" />

      <div className="teacher-login-shell">
        <section className="teacher-login-hero">
          <span className="teacher-login-badge">Gojo Teacher Portal</span>
          <h1>Welcome, Teacher</h1>
          <p>
            Sign in to manage your classes, track student progress, and stay connected with your school.
          </p>
          <ul className="teacher-login-list">
            <li>Use your teacher username and password</li>
            <li>Your school is detected automatically from your username</li>
            <li>Need help? Contact your school administration</li>
          </ul>
        </section>

        <section className="teacher-login-card-wrap">
          <div className="teacher-login-card">
            <h2>Teacher Login</h2>
            <p className="teacher-login-sub">Use your teacher credentials to continue.</p>

            {message ? <p className="teacher-login-alert">{message}</p> : null}

            <form onSubmit={handleLogin} className="teacher-login-form" noValidate>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Example: GMIT_0001_26"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, username: "" }));
                }}
                autoComplete="username"
                disabled={loading}
              />
              {fieldErrors.username ? <p className="teacher-login-field-error">{fieldErrors.username}</p> : null}
              {/* <p className="teacher-login-meta">
                {schoolPrefix
                  ? `Detected school prefix: ${schoolPrefix}`
                  : "School prefix will be detected from the first 3 letters of your username."}
              </p> */}

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
              {fieldErrors.password ? <p className="teacher-login-field-error">{fieldErrors.password}</p> : null}

              <button type="submit" className="teacher-login-button" disabled={!canSubmit}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="teacher-login-footer">
              Don&apos;t have an account? <Link to={registerLink}>Register</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
