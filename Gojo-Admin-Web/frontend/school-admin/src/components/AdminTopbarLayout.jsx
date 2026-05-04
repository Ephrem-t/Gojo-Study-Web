import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import TopbarActions from "./TopbarActions";
import useTopbarNotifications, { NOTIFICATION_POLL_MS } from "../hooks/useTopbarNotifications";
import { FIREBASE_DATABASE_URL } from "../config.js";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/my-posts": "My Posts",
  "/overview": "Overview",
  "/teachers": "Teachers",
  "/students": "Students",
  "/parents": "Parents",
  "/schedule": "Schedule",
  "/assign-teacher": "Assign Teacher",
  "/academic-year": "Academic Year",
  "/subject-management": "Subject Management",
  "/grade-and-section": "Subject Management",
  "/grades": "Subject Management",
  "/sections": "Subject Management",
  "/exams": "Exams",
  "/results": "Results",
  "/report-cards": "Report Cards",
  "/settings": "Settings",
  "/all-chat": "All Chat",
  "/message-control": "Message Control",
  "/student-chat": "Student Chat",
  "/teacher-register": "Teacher Register",
  "/student-register": "Student Register",
  "/parent-register": "Parent Register",
};

const ROUTES_WITH_PERSISTENT_SIDEBAR = new Set([
  "/dashboard",
  "/my-posts",
  "/overview",
  "/teachers",
  "/students",
  "/parents",
  "/schedule",
  "/assign-teacher",
  "/academic-year",
  "/subject-management",
  "/assessment",
  "/grade-and-section",
  "/grades",
  "/sections",
  "/exams",
  "/results",
  "/report-cards",
  "/settings",
  "/message-control",
]);

const readStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "{}") || {};
  } catch (error) {
    return {};
  }
};

const getSafeImageUrl = (value, fallback = "/default-profile.png") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return fallback;
  }

  const lowerValue = normalizedValue.toLowerCase();
  if (lowerValue.startsWith("file://") || lowerValue.startsWith("content://")) {
    return fallback;
  }

  return normalizedValue;
};

export default function AdminTopbarLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = readStoredAdmin();
  const schoolCode = String(admin?.schoolCode || "").trim();
  const disabledSharedNotificationRoutes = new Set([
    "/all-chat",
    "/message-control",
    "/teachers",
    "/students",
    "/schedule",
    "/parents",
  ]);
  const sharedNotificationsEnabled = !disabledSharedNotificationRoutes.has(location.pathname);
  const dbRoot = schoolCode
    ? `${FIREBASE_DATABASE_URL}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : FIREBASE_DATABASE_URL;
  const currentUserId = admin?.userId || "";
  const title = PAGE_TITLES[location.pathname] || "Dashboard";
  const sidebarEnabled = ROUTES_WITH_PERSISTENT_SIDEBAR.has(location.pathname);
  const sidebarAdmin = {
    ...admin,
    adminId: admin?.adminId || admin?.username || "",
    profileImage: getSafeImageUrl(admin?.profileImage, "/default-profile.png"),
  };
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts,
    messageCount,
    totalNotifications,
    refreshNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot,
    currentUserId,
    enabled: sharedNotificationsEnabled,
    pollMs: NOTIFICATION_POLL_MS,
  });

  return (
    <div
      style={{
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--page-bg": "#ffffff",
        "--page-bg-secondary": "#f7fbff",
        "--surface-panel": "#ffffff",
        "--surface-muted": "#F7FBFF",
        "--surface-accent": "#F1F8FF",
        "--surface-overlay": "#F1F8FF",
        "--surface-strong": "#DCEBFF",
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#007afb",
        "--accent-strong": "#007afb",
        "--accent-soft": "#E7F2FF",
        "--success": "#00B6A9",
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-soft": "#fff1f2",
        "--danger-border": "#fca5a5",
        "--input-bg": "#ffffff",
        "--input-border": "#B5D2F8",
        "--shadow-soft": "0 10px 24px rgba(0, 122, 251, 0.10)",
        "--shadow-panel": "0 14px 30px rgba(0, 122, 251, 0.14)",
        "--shadow-glow": "0 0 0 2px rgba(0, 122, 251, 0.18)",
      }}
    >
      <Navbar
        title={title}
        admin={sidebarAdmin}
      >
        <TopbarActions
          unreadPosts={unreadPosts}
          unreadSenders={unreadSenders}
          totalNotifications={totalNotifications}
          messageCount={messageCount}
          onOpenNotifications={refreshNotifications}
          onPostClick={async (notification) => {
            await markPostAsSeen(notification?.postId);
            navigate("/dashboard", {
              state: { postId: notification?.postId },
            });
          }}
          onMessageClick={async (userId, sender) => {
            await markMessagesAsSeen(userId);
            setUnreadSenders((previousSenders) => {
              const nextSenders = { ...previousSenders };
              delete nextSenders[userId];
              return nextSenders;
            });
            navigate("/all-chat", {
              state: {
                user: {
                  userId,
                  name: sender?.name,
                  profileImage: sender?.profileImage,
                  type: sender?.type,
                },
              },
            });
          }}
        />
      </Navbar>

      {sidebarEnabled ? (
        <Sidebar
          admin={sidebarAdmin}
          style={{
            position: "fixed",
            top: "calc(var(--topbar-height) + 18px)",
            left: 14,
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            maxWidth: "var(--sidebar-width)",
            height: "calc(100vh - var(--topbar-height) - 36px)",
            maxHeight: "calc(100vh - var(--topbar-height) - 36px)",
            marginLeft: 0,
            marginRight: 0,
            zIndex: 30,
          }}
          top={4}
          fullHeight
        />
      ) : null}

      <Outlet />
    </div>
  );
}