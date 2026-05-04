import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBookOpen,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaChartBar,
  FaChevronDown,
  FaChevronRight,
  FaClipboardCheck,
  FaCog,
  FaHome,
  FaComments,
  FaFileAlt,
  FaSignOutAlt,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";
import { resolveProfileImage } from "../utils/profileImage";
import { getRtdbRoot } from "../api/rtdbScope";

const TEACHER_BEFORE_APP_NAVIGATION_HANDLER = "__teacherBeforeAppNavigation";

const SIDEBAR_SECTIONS = [
  {
    key: "workspace",
    title: "Workspace",
    icon: FaHome,
    items: [
      { to: "/dashboard", label: "Home", icon: FaHome, matches: ["dashboard"] },
      { to: "/all-chat", label: "Messages", icon: FaComments, matches: ["all-chat"] },
    ],
  },
  {
    key: "people",
    title: "People",
    icon: FaUsers,
    items: [
      { to: "/students", label: "Students", icon: FaUsers, matches: ["students"] },
      { to: "/parents", label: "Parents", icon: FaChalkboardTeacher, matches: ["parents"] },
      { to: "/admins", label: "Admins", icon: FaUsers, matches: ["admins"] },
    ],
  },
  {
    key: "teaching",
    title: "Teaching",
    icon: FaBookOpen,
    items: [
      { to: "/marks", label: "Marks", icon: FaClipboardCheck, matches: ["marks"] },
      { to: "/attendance", label: "Attendance", icon: FaUserCheck, matches: ["attendance"] },
      { to: "/timetable", label: "Timetable", icon: FaCalendarAlt, matches: ["schedule", "timetable"] },
      { to: "/exam", label: "Exam", icon: FaFileAlt, matches: ["exam"] },
      { to: "/lesson-plan", label: "Lesson Plan", icon: FaBookOpen, matches: ["lesson-plan"] },
      { to: "/student-feedback", label: "Student Feedback", icon: FaChartBar, matches: ["student-feedback"] },
    ],
  },
  {
    key: "account",
    title: "Account",
    icon: FaCog,
    items: [
      { to: "/settings", label: "Settings", icon: FaCog, matches: ["settings"] },
      { label: "Logout", icon: FaSignOutAlt, action: "logout" },
    ],
  },
];

const createDefaultSectionsState = () =>
  SIDEBAR_SECTIONS.reduce((result, section) => {
    result[section.key] = section.key === "workspace" || section.key === "people";
    return result;
  }, {});

const STORAGE_KEY = "teacher_sidebar_sections_state";

export const TeacherSidebarPersistenceContext = createContext(false);

const readStoredSections = () => {
  const defaults = createDefaultSectionsState();

  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return defaults;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return defaults;
    }

    return Object.keys(defaults).reduce((normalized, sectionKey) => {
      normalized[sectionKey] = Boolean(parsedValue[sectionKey]);
      return normalized;
    }, {});
  } catch (error) {
    return defaults;
  }
};

const readStoredTeacherSnapshot = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("teacher") || "null");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const readCachedTeacherProfileImage = (teacherUserId) => {
  if (!teacherUserId) return "";
  try {
    return String(localStorage.getItem(`teacher_profile_image_${teacherUserId}`) || "").trim();
  } catch {
    return "";
  }
};

const writeCachedTeacherProfileImage = (teacherUserId, imageUrl) => {
  if (!teacherUserId || !imageUrl) return;
  try {
    localStorage.setItem(`teacher_profile_image_${teacherUserId}`, imageUrl);
  } catch {
    // ignore localStorage failures
  }
};

const buildUsersLookupUrls = (rtdbBase, schoolCode) => {
  const urls = [`${rtdbBase}/Users.json`];
  const scopedPrefix = schoolCode ? `/Platform1/Schools/${schoolCode}` : "";
  const alreadyScoped = scopedPrefix && rtdbBase.includes(scopedPrefix);

  if (schoolCode && !alreadyScoped) {
    urls.push(`${rtdbBase}/Platform1/Schools/${schoolCode}/Users.json`);
  }

  return [...new Set(urls)];
};

export default function Sidebar({
  active,
  sidebarOpen,
  setSidebarOpen,
  teacher,
  handleLogout,
  persistent = false,
}) {
  const hasPersistentSidebar = useContext(TeacherSidebarPersistenceContext);

  if (hasPersistentSidebar && !persistent) {
    return null;
  }

  const RTDB_BASE = getRtdbRoot();
  const location = useLocation();
  const navigate = useNavigate();
  const [sectionsOpen, setSectionsOpen] = useState(() => readStoredSections());
  const [staticTeacherSnapshot] = useState(() => readStoredTeacherSnapshot());

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
  const currentPath = location.pathname;
  const openSidebar = () => setSidebarOpen?.(true);
  const closeSidebar = () => setSidebarOpen?.(false);

  const profileName =
    staticTeacherSnapshot?.name || teacher?.name || "Teacher";
  const profileId =
    staticTeacherSnapshot?.username ||
    staticTeacherSnapshot?.teacherId ||
    staticTeacherSnapshot?.userId ||
    teacher?.username ||
    teacher?.teacherId ||
    teacher?.userId ||
    "teacher";
  const teacherUserId = String(teacher?.userId || "").trim();
  const snapshotUserId = String(staticTeacherSnapshot?.userId || "").trim();
  const effectiveTeacherUserId = snapshotUserId || teacherUserId;
  const cachedProfileImage = readCachedTeacherProfileImage(effectiveTeacherUserId);
  const baseProfileImage = resolveProfileImage(
    cachedProfileImage,
    staticTeacherSnapshot?.profileImage,
    staticTeacherSnapshot?.profile,
    staticTeacherSnapshot?.avatar,
    teacher?.profileImage,
    teacher?.profile,
    teacher?.avatar
  );
  const [profileImage, setProfileImage] = useState(baseProfileImage);

  useEffect(() => {
    setProfileImage(baseProfileImage);
  }, [baseProfileImage]);

  useEffect(() => {
    const schoolCode = String(teacher?.schoolCode || "").trim();
    if (!effectiveTeacherUserId) return;

    let cancelled = false;

    const hydrateProfileFromUsers = async () => {
      try {
        const urls = buildUsersLookupUrls(RTDB_BASE, schoolCode);

        let matchedUser = null;

        for (const url of urls) {
          try {
            const response = await axios.get(url);
            const usersObj = response.data || {};
            if (usersObj && typeof usersObj === "object") {
              matchedUser =
                usersObj[teacherUserId] ||
                Object.entries(usersObj).find(([userKey, userItem]) =>
                  String(userKey || "").trim() === effectiveTeacherUserId ||
                  String(userItem?.userId || "").trim() === effectiveTeacherUserId
                )?.[1] ||
                null;
            }
            if (matchedUser) break;
          } catch (error) {
            // try next URL
          }
        }

        if (!matchedUser || cancelled) return;

        const resolvedImage = resolveProfileImage(
          readCachedTeacherProfileImage(effectiveTeacherUserId),
          matchedUser.profileImage,
          matchedUser.profile,
          staticTeacherSnapshot?.profileImage,
          staticTeacherSnapshot?.profile,
          staticTeacherSnapshot?.avatar,
          teacher?.profileImage,
          teacher?.profile,
          teacher?.avatar
        );

        setProfileImage(resolvedImage);
        writeCachedTeacherProfileImage(effectiveTeacherUserId, resolvedImage);

        const storedTeacher = JSON.parse(localStorage.getItem("teacher") || "null");
        if (
          storedTeacher &&
          String(storedTeacher.userId || "").trim() === effectiveTeacherUserId
        ) {
          localStorage.setItem(
            "teacher",
            JSON.stringify({
              ...storedTeacher,
              ...matchedUser,
              profileImage: resolvedImage,
            })
          );
        }
      } catch (error) {
        // ignore and keep existing image
      }
    };

    hydrateProfileFromUsers();

    return () => {
      cancelled = true;
    };
  }, [
    RTDB_BASE,
    effectiveTeacherUserId,
    teacher?.schoolCode,
    teacher?.profileImage,
    teacher?.profile,
    teacher?.avatar,
    staticTeacherSnapshot?.profileImage,
    staticTeacherSnapshot?.profile,
    staticTeacherSnapshot?.avatar,
  ]);

  const isItemActive = useMemo(
    () => (item) => item.to === currentPath || item.matches?.includes(active),
    [active, currentPath]
  );

  const isSectionActive = (section) => section.items.some((item) => isItemActive(item));

  const toggleSection = (sectionKey) => {
    setSectionsOpen((previous) => {
      const nextValue = { ...previous, [sectionKey]: !previous[sectionKey] };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
      } catch (error) {
        // Ignore localStorage write failures.
      }

      return nextValue;
    });
  };

  const runBeforeAppNavigation = async (intent = {}) => {
    if (typeof window === "undefined") return true;

    const handler = window[TEACHER_BEFORE_APP_NAVIGATION_HANDLER];
    if (typeof handler !== "function") {
      return true;
    }

    try {
      const result = await handler(intent);
      return result !== false;
    } catch (error) {
      console.error("Teacher navigation guard failed:", error);
      return false;
    }
  };

  const handleRouteClick = async (event, to) => {
    if (!to) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();

    if (to === currentPath) {
      if (isMobile) closeSidebar();
      return;
    }

    const canContinue = await runBeforeAppNavigation({
      type: "route",
      from: currentPath,
      to,
    });
    if (!canContinue) return;

    if (isMobile) closeSidebar();
    navigate(to);
  };

  const onLogout = async () => {
    const canContinue = await runBeforeAppNavigation({
      type: "logout",
      from: currentPath,
    });
    if (!canContinue) return;

    if (handleLogout) {
      await handleLogout();
      return;
    }

    localStorage.removeItem("teacher");
    navigate("/login", { replace: true });
  };

  const rootStyle = {
    width: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
    minWidth: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
    height: "calc(100vh - var(--topbar-height) - 8px)",
    padding: 14,
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "stretch",
    position: "fixed",
    top: "calc(var(--topbar-height) + 8px)",
    left: 12,
    zIndex: 40,
    borderRadius: 18,
    border: "1px solid #dbe2f0",
    boxSizing: "border-box",
    overflowY: "auto",
    overflowX: "hidden",
  };

  const profileCardStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "14px 10px 12px",
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  };

  const sectionButtonBaseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #dbe2f0",
    background: "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
  };

  const linkBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 700,
    boxSizing: "border-box",
  };

  const linkActiveStyle = {
    background: "#007AFB",
    color: "#ffffff",
    border: "1px solid #1d4ed8",
    boxShadow: "0 10px 18px rgba(29, 78, 216, 0.24)",
  };

  return (
    <>
      {typeof window !== "undefined" && window.innerWidth <= 600 && !sidebarOpen && (
        <button
          className="sidebar-arrow-btn"
          onClick={openSidebar}
          aria-label="Open sidebar menu"
        >
          <FaChevronRight size={22} />
        </button>
      )}

      {typeof window !== "undefined" && window.innerWidth <= 600 && sidebarOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={closeSidebar}
        />
      )}

      <div
        className={`google-sidebar${isMobile && sidebarOpen ? " open" : ""}`}
        style={rootStyle}
      >
        <style>{`
          .sidebar-arrow-btn {
            position: fixed;
            left: 0;
            top: var(--topbar-height);
            z-index: 1300;
            background: #ffffff;
            border: none;
            border-radius: 0 10px 10px 0;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
            padding: 10px 8px;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .sidebar-overlay {
            display: none;
          }
          .teacher-sidebar-link:hover {
            background: linear-gradient(135deg, #eff6ff, #eef2ff);
            border-color: #c7d2fe;
            color: #007AFB;
            transform: translateX(2px);
          }
          @media (max-width: 600px) {
            .google-sidebar {
              top: var(--topbar-height) !important;
              left: -220px !important;
              width: 220px !important;
              min-width: 220px !important;
              height: calc(100vh - var(--topbar-height)) !important;
              transition: left 0.25s cubic-bezier(.4,0,.2,1);
              border-radius: 0 !important;
              padding-top: 10px !important;
              z-index: 1202 !important;
            }
            .google-sidebar.open {
              left: 0 !important;
              z-index: 1202;
              border-radius: 0 !important;
            }
            .sidebar-overlay {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.35);
              z-index: 1200;
              transition: opacity 0.2s;
            }
            .sidebar-arrow-btn {
              display: flex !important;
            }
          }
        `}</style>

        <div className="sidebar-profile" style={profileCardStyle}>
          <div
            className="sidebar-img-circle"
            style={{
              width: 52,
              height: 52,
              border: "2px solid #bfdbfe",
              boxShadow: "0 8px 20px rgba(37, 99, 235, 0.18)",
              marginBottom: 2,
            }}
          >
            <ProfileAvatar
              src={profileImage}
              name={profileName}
              alt="profile"
            />
          </div>
          <div
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              background: "#ffffff",
              border: "1px solid #007AFB",
              color: "#007AFB",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Teacher Space
          </div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
            {profileName}
          </h3>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
            {profileId}
          </p>
        </div>

        <div
          className="sidebar-menu"
          style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 2 }}
        >
          {SIDEBAR_SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = Boolean(sectionsOpen[section.key]);
            const sectionActive = isSectionActive(section);

            return (
              <div key={section.key} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  style={
                    sectionActive || isOpen
                      ? {
                          ...sectionButtonBaseStyle,
                          background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
                          border: sectionActive ? "1px solid #60a5fa" : "1px solid #bfdbfe",
                          boxShadow: sectionActive
                            ? "0 10px 18px rgba(37, 99, 235, 0.14)"
                            : "none",
                        }
                      : sectionButtonBaseStyle
                  }
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SectionIcon style={{ width: 14, height: 14, color: "#007AFB" }} />
                    {section.title}
                  </span>
                  <FaChevronDown
                    style={{
                      width: 12,
                      height: 12,
                      color: "#007AFB",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 160ms ease",
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginLeft: 10,
                      paddingLeft: 10,
                      borderLeft: "2px solid #dbeafe",
                    }}
                  >
                    {section.items.map(({ to, label, icon: Icon, action }) => {
                      if (action === "logout") {
                        return (
                          <button
                            key={`${section.key}-${label}`}
                            type="button"
                            className="sidebar-btn teacher-sidebar-link logout-btn"
                            onClick={onLogout}
                            style={{
                              ...linkBaseStyle,
                              background: "#fff1f2",
                              border: "1px solid #fecdd3",
                              color: "#be123c",
                              cursor: "pointer",
                            }}
                          >
                            <Icon style={{ width: 14, height: 14 }} />
                            {label}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={to}
                          className="sidebar-btn teacher-sidebar-link"
                          to={to}
                          onClick={(event) => {
                            void handleRouteClick(event, to);
                          }}
                          style={isItemActive({ to, matches: [] }) ? { ...linkBaseStyle, ...linkActiveStyle } : linkBaseStyle}
                        >
                          <Icon style={{ width: 14, height: 14 }} />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
