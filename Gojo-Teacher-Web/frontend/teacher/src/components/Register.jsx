import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";
import { API_BASE } from "../api/apiConfig";

export default function Register() {
  const navigate = useNavigate();
  const loginLink = "/login";

  const subjectOptions = {
    "7": [
      "Mathematics",
      "Amharic",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Oromifa",
      "Physical Education",
    ],
    "8": [
     "Mathematics",
      "Amharic",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Oromifa",
      "Physical Education",
    ],
    "9": [
      "Mathematics",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Physical Education",
    ],
    "10": [
     "Mathematics",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Physical Education",
    ],
    "11 Social": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],

    "11 Natural": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
    "12 Social": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
    "12 Natural": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
  };
  const allSubjects = Array.from(
    new Set(Object.values(subjectOptions).flat())
  );

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    email: "",
    phone: "",
    gender: "",
    courses: [{ grade: "", section: "", subject: "" }],
  });
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [gradeOptions, setGradeOptions] = useState([]);
  const [sectionsByGrade, setSectionsByGrade] = useState({});
  const [loadingGrades, setLoadingGrades] = useState(false);

  useEffect(() => {
    const loadSchools = async () => {
      setLoadingSchools(true);
      try {
        const registerBase = API_BASE.replace(/\/api$/, "");
        const res = await fetch(`${registerBase}/api/schools`);
        const data = await res.json();
        const list = Array.isArray(data.schools) ? data.schools : [];
        setSchools(list);

        if (list.length === 1) {
          setSchoolCode(list[0].schoolCode || "");
        }
      } catch (err) {
        console.error("Failed to load schools:", err);
        setSchools([]);
        setMessage("Unable to load schools. Check backend/API.");
      } finally {
        setLoadingSchools(false);
      }
    };

    loadSchools();
  }, []);

  useEffect(() => {
    const loadGrades = async () => {
      if (!schoolCode) {
        setGradeOptions([]);
        setSectionsByGrade({});
        return;
      }

      setLoadingGrades(true);
      try {
        const registerBase = API_BASE.replace(/\/api$/, "");
        const res = await fetch(`${registerBase}/api/schools/${encodeURIComponent(schoolCode)}/grades`);
        const data = await res.json();
        const rows = Array.isArray(data.grades) ? data.grades : [];

        const grades = rows
          .map((row) => String(row.grade || "").trim())
          .filter(Boolean);

        const sectionMap = {};
        rows.forEach((row) => {
          const grade = String(row.grade || "").trim();
          if (!grade) return;
          const sections = Array.isArray(row.sections)
            ? row.sections.map((s) => String(s).trim()).filter(Boolean)
            : [];
          sectionMap[grade] = sections;
        });

        setGradeOptions(grades);
        setSectionsByGrade(sectionMap);

        // Reset existing course grade/section if they are not valid for selected school.
        setFormData((prev) => ({
          ...prev,
          courses: prev.courses.map((course) => {
            const gradeValid = grades.includes(course.grade);
            const nextGrade = gradeValid ? course.grade : "";
            const sections = nextGrade ? (sectionMap[nextGrade] || []) : [];
            const sectionValid = sections.includes(course.section);
            return {
              ...course,
              grade: nextGrade,
              section: sectionValid ? course.section : "",
              subject: gradeValid ? course.subject : "",
            };
          }),
        }));
      } catch (err) {
        console.error("Failed to load grades:", err);
        setGradeOptions([]);
        setSectionsByGrade({});
      } finally {
        setLoadingGrades(false);
      }
    };

    loadGrades();
  }, [schoolCode]);

  const handleChange = (e, index = null) => {
    const { name, value } = e.target;
    if (index !== null) {
      const updatedCourses = [...formData.courses];
      updatedCourses[index][name] = value;
      if (name === "grade") {
        updatedCourses[index]["subject"] = "";
        updatedCourses[index]["section"] = "";
      }
      setFormData({ ...formData, courses: updatedCourses });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addCourse = () => {
    setFormData({
      ...formData,
      courses: [...formData.courses, { grade: "", section: "", subject: "" }],
    });
  };

  const removeCourse = (index) => {
    const updatedCourses = formData.courses.filter((_, i) => i !== index);
    setFormData({ ...formData, courses: updatedCourses });
  };

  const hasDuplicateCourse = () => {
    const seen = new Set();

    for (let c of formData.courses) {
      if (!c.grade || !c.section || !c.subject) continue;

      const key = `${c.grade}${c.section}-${c.subject}`;

      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }
    return false;
  };

  const validateEmail = (email) =>
    email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

  const validatePhone = (phone) =>
    /^[0-9+()\-\s]{6,20}$/.test(String(phone).trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setAssignedTeacherId("");

    // Frontend validation
    if (!validateEmail(formData.email)) {
      setMessage("Please enter a valid email address or leave it empty.");
      return;
    }
    if (!validatePhone(formData.phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }
    if (!formData.gender) {
      setMessage("Please select gender.");
      return;
    }
    if (!formData.name || !formData.password) {
      setMessage("Name and password are required.");
      return;
    }
    if (!schoolCode) {
      setMessage("Please select school.");
      return;
    }
    if (!formData.courses.every((c) => c.grade)) {
      setMessage("Please select grade for each course.");
      return;
    }
    if (hasDuplicateCourse()) {
      setMessage(
        "Duplicate subject detected! A subject can only be taught once per grade and section."
      );
      return;
    }

    try {
      const dataToSend = new FormData();
      // NOTE: username removed from frontend. Server will set username = teacherId
      dataToSend.append("name", formData.name);
      dataToSend.append("password", formData.password);
      dataToSend.append("email", formData.email);
      dataToSend.append("phone", formData.phone);
      dataToSend.append("gender", formData.gender);
      dataToSend.append("courses", JSON.stringify(formData.courses));
      dataToSend.append("schoolCode", schoolCode);
      if (profile) dataToSend.append("profile", profile);

      const registerBase = API_BASE.replace(/\/api$/, "");
      const res = await fetch(`${registerBase}/register/teacher`, {
        method: "POST",
        body: dataToSend,
      });

      const data = await res.json();

      if (data.success) {
        // Backend returns teacherId in response (assigned username)
        const tid = data.teacherKey || data.teacherId || "";
        setAssignedTeacherId(tid);
        setFormData({
          name: "",
          password: "",
          email: "",
          phone: "",
          gender: "",
          courses: [{ grade: "", section: "", subject: "" }],
        });
        setProfile(null);
        setMessage("Registration successful. Your teacherId (username) is shown below.");
        // Optionally auto-navigate to login after a short delay:
        // setTimeout(() => navigate("/login"), 4000);
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof TypeError && /Failed to fetch/i.test(err.message || "")) {
        setMessage("Backend is not running on 127.0.0.1:5000. Start app.py and try again.");
      } else {
        setMessage("Server error. Check console.");
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: "820px", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: "none", border: "none", color: "black", cursor: "pointer", fontSize: 20, width: 10, padding: 0 }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>Teacher Registration</h2>
        </div>
        <p className="subtle">Create a teacher account for the selected school.</p>
        {message && <p className="auth-error">{message}</p>}

        <form onSubmit={handleRegister} className="vertical-form">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <select
            name="schoolCode"
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            required
            disabled={loadingSchools}
          >
            <option value="">
              {loadingSchools ? "Loading schools..." : "Select School"}
            </option>
            {schools.map((school) => (
              <option key={school.schoolCode} value={school.schoolCode}>
                {school.name} ({school.shortName || school.schoolCode})
              </option>
            ))}
          </select>

          {/* Username removed from form - server will assign teacherId as username */}

          <input
            type="email"
            name="email"
            placeholder="Email (optional)"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div className="profile-upload">
            {profile && (
              <img
                src={URL.createObjectURL(profile)}
                alt="Profile Preview"
                className="profile-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfile(e.target.files[0])}
            />
          </div>

          <h3 style={{ textAlign: "left", marginBottom: 10, fontWeight: 700, color: "#334155", fontSize: 18 }}>Course Assignments</h3>
          {formData.courses.map((course, index) => (
            <div className="course-group" key={index}>
              <select
                name="grade"
                value={course.grade}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={loadingGrades || gradeOptions.length === 0}
              >
                <option value="">{loadingGrades ? "Loading grades..." : "Select Grade"}</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                name="section"
                value={course.section}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={!course.grade}
              >
                <option value="">Select Section</option>
                {(sectionsByGrade[course.grade] || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                name="subject"
                value={course.subject}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={!course.grade}
              >
                <option value="">Select Subject</option>
                {course.grade &&
                  (subjectOptions[course.grade] || allSubjects).map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
              </select>

              {formData.courses.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeCourse(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" className="add-btn" onClick={addCourse}>
            Add Course
          </button>
          <button type="submit" className="submit-btn">
            Register
          </button>
        </form>

        {assignedTeacherId && (
          <div className="auth-success" style={{ marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, textAlign: "left" }}>
            <p>
              Registration complete. Your teacherId (username) is:{" "}
              <strong>{assignedTeacherId}</strong>
            </p>
            <p>
              Use this ID to log in: <Link to={loginLink}>Go to Login</Link>
            </p>
          </div>
        )}

        <p>
          Already have an account? <Link to={loginLink}>Go to Login</Link>
        </p>
      </div>
    </div>
  );
}