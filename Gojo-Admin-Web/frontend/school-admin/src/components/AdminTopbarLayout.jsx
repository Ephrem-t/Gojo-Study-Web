import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import TopbarActions from "./TopbarActions";
import useTopbarNotifications from "../hooks/useTopbarNotifications";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

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
  "/student-chat": "Student Chat",
  "/teacher-register": "Teacher Register",
  "/student-register": "Student Register",
  "/parent-register": "Parent Register",
};

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
  const dbRoot = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;
  const currentUserId = admin?.userId || "";
  const title = PAGE_TITLES[location.pathname] || "Dashboard";
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot,
    currentUserId,
  });

  return (
    <>
      <Navbar
        title={title}
        admin={{
          ...admin,
          profileImage: getSafeImageUrl(admin?.profileImage, "/default-profile.png"),
        }}
      >
        <TopbarActions
          unreadPosts={unreadPosts}
          unreadSenders={unreadSenders}
          totalNotifications={totalNotifications}
          messageCount={messageCount}
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

      <Outlet />
    </>
  );
}