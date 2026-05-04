import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import TeacherTopbar from "./TeacherTopbar";
import TeacherTopbarActions from "./TeacherTopbarActions";
import Sidebar, { TeacherSidebarPersistenceContext } from "./Sidebar";
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
import { resolveProfileImage } from "../utils/profileImage";
import {
  buildSchoolRtdbBase,
  fetchTeacherConversationSummaries,
  loadUserRecordById,
  normalizeIdentifier,
  readSessionResource,
  resolveTeacherSchoolCode,
  writeSessionResource,
} from "../utils/teacherData";

const readTeacherFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem("teacher") || "null");
  } catch (error) {
    return null;
  }
};

const readSeenPosts = (teacherUserId) => {
  if (!teacherUserId) return [];
  try {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherUserId}`) || "[]");
  } catch (error) {
    return [];
  }
};

const writeSeenPost = (teacherUserId, postId) => {
  if (!teacherUserId || !postId) return;
  const seen = readSeenPosts(teacherUserId);
  if (seen.includes(postId)) return;
  localStorage.setItem(`seen_posts_${teacherUserId}`, JSON.stringify([...seen, postId]));
};

const readTeacherSettingsPreferences = (teacherUserId) => {
  if (!teacherUserId) {
    return {
      emailAlerts: true,
      pushAlerts: true,
      weeklyDigest: false,
      compactCards: false,
    };
  }

  try {
    return {
      emailAlerts: true,
      pushAlerts: true,
      weeklyDigest: false,
      compactCards: false,
      ...(JSON.parse(localStorage.getItem(`teacher_settings_preferences_${teacherUserId}`) || "{}") || {}),
    };
  } catch {
    return {
      emailAlerts: true,
      pushAlerts: true,
      weeklyDigest: false,
      compactCards: false,
    };
  }
};

const normalizeToList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
};

const POSTS_SESSION_TTL_MS = 5 * 60 * 1000;
const MESSAGES_SESSION_TTL_MS = 2 * 60 * 1000;
const NOTIFICATION_PASSIVE_CHECK_MS = 60 * 1000;
const NOTIFICATION_IDLE_GRACE_MS = 60 * 1000;

const buildPostsCacheKey = (schoolCode, teacherUserId) => {
  return `layout:posts:${String(schoolCode || "global").toUpperCase()}:${String(teacherUserId || "").trim()}`;
};

const buildMessagesCacheKey = (schoolCode, teacherUserId) => {
  return `layout:messages:${String(schoolCode || "global").toUpperCase()}:${String(teacherUserId || "").trim()}`;
};

const writeCachedTeacherProfileImage = (teacherUserId, imageUrl) => {
  if (!teacherUserId || !imageUrl || imageUrl === "/default-profile.png") return;
  try {
    localStorage.setItem(`teacher_profile_image_${teacherUserId}`, imageUrl);
  } catch {
    // ignore localStorage failures
  }
};

export default function TeacherAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const hidePersistentSidebar = location.pathname === "/all-chat";
  const [showNotifications, setShowNotifications] = useState(false);
  const [teacher, setTeacher] = useState(() => readTeacherFromStorage());
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 600 : true
  );
  const [postNotifications, setPostNotifications] = useState([]);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [messageCount, setMessageCount] = useState(0);
  const [settingsPreferences, setSettingsPreferences] = useState(() =>
    readTeacherSettingsPreferences(readTeacherFromStorage()?.userId)
  );
  const notificationRefreshRef = useRef(async () => {});
  const notificationRefreshPromiseRef = useRef(null);
  const lastTeacherInteractionAtRef = useRef(Date.now());
  const lastPostsRefreshAtRef = useRef(0);
  const lastMessagesRefreshAtRef = useRef(0);
  const resolvedSchoolCodeRef = useRef("");

  const applyVisibleMessages = (messages, pushAlertsEnabled) => {
    const visibleMessages = pushAlertsEnabled ? messages : [];
    setMessageNotifications(visibleMessages);
    setMessageCount(
      visibleMessages.reduce((sum, item) => sum + Number(item?.unreadForMe || 0), 0)
    );
  };

  useEffect(() => {
    setTeacher(readTeacherFromStorage());
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = typeof window !== "undefined" && window.innerWidth <= 600;
      setSidebarOpen(!nextIsMobile);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setSettingsPreferences(readTeacherSettingsPreferences(teacher?.userId));
  }, [location.pathname, teacher?.userId]);

  useEffect(() => {
    const syncPreferences = () => {
      setSettingsPreferences(readTeacherSettingsPreferences(readTeacherFromStorage()?.userId));
    };

    window.addEventListener("storage", syncPreferences);
    window.addEventListener("teacher-settings-preferences-changed", syncPreferences);
    return () => {
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener("teacher-settings-preferences-changed", syncPreferences);
    };
  }, []);

  useEffect(() => {
    const currentTeacher = readTeacherFromStorage();
    const teacherUserId = normalizeIdentifier(currentTeacher?.userId);
    if (!teacherUserId) return;

    let cancelled = false;

    const hydrateTeacherProfile = async () => {
      try {
        const resolvedSchoolCode = await resolveTeacherSchoolCode(currentTeacher?.schoolCode);
        const rtdbBase = resolvedSchoolCode ? buildSchoolRtdbBase(resolvedSchoolCode) : getRtdbRoot();
        const matchedUser = await loadUserRecordById({
          rtdbBase,
          schoolCode: resolvedSchoolCode,
          userId: teacherUserId,
        });

        if (!matchedUser || cancelled) return;

        const mergedTeacher = {
          ...currentTeacher,
          ...matchedUser,
          schoolCode: resolvedSchoolCode || currentTeacher?.schoolCode || "",
          profileImage: resolveProfileImage(
            matchedUser.profileImage,
            matchedUser.profile,
            currentTeacher?.profileImage,
            currentTeacher?.profile,
            currentTeacher?.avatar
          ),
        };

        localStorage.setItem("teacher", JSON.stringify(mergedTeacher));
        setTeacher(mergedTeacher);
        writeCachedTeacherProfileImage(teacherUserId, mergedTeacher.profileImage);
      } catch (error) {
        // keep existing teacher state
      }
    };

    hydrateTeacherProfile();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!teacher?.userId) {
      setPostNotifications([]);
      setMessageNotifications([]);
      setMessageCount(0);
      notificationRefreshRef.current = async () => {};
      lastPostsRefreshAtRef.current = 0;
      lastMessagesRefreshAtRef.current = 0;
      resolvedSchoolCodeRef.current = "";
      return;
    }

    let cancelled = false;

    notificationRefreshRef.current = async ({
      reason = "passive",
      forcePosts = false,
      forceMessages = false,
    } = {}) => {
      const isVisible = typeof document === "undefined" || document.visibilityState === "visible";
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      const isUserDriven = reason !== "passive";
      const recentInteraction = Date.now() - lastTeacherInteractionAtRef.current < NOTIFICATION_IDLE_GRACE_MS;

      const canUseNetwork = isUserDriven || showNotifications || (isVisible && isOnline && recentInteraction);
      const cachedSchoolCode =
        normalizeIdentifier(resolvedSchoolCodeRef.current) || normalizeIdentifier(teacher?.schoolCode);
      const postsCacheKey = buildPostsCacheKey(cachedSchoolCode, teacher.userId);
      const messagesCacheKey = buildMessagesCacheKey(cachedSchoolCode, teacher.userId);
      const cachedPosts = readSessionResource(postsCacheKey, { ttlMs: POSTS_SESSION_TTL_MS });
      const cachedMessages = readSessionResource(messagesCacheKey, { ttlMs: MESSAGES_SESSION_TTL_MS });

      if (Array.isArray(cachedPosts) && !cancelled) {
        setPostNotifications(settingsPreferences.emailAlerts ? cachedPosts : []);
        if (!lastPostsRefreshAtRef.current) {
          lastPostsRefreshAtRef.current = Date.now();
        }
      }

      if (Array.isArray(cachedMessages) && !cancelled) {
        applyVisibleMessages(cachedMessages, settingsPreferences.pushAlerts);
        if (!lastMessagesRefreshAtRef.current) {
          lastMessagesRefreshAtRef.current = Date.now();
        }
      }

      if (!canUseNetwork) {
        return;
      }

      const resolvedSchoolCode = await resolveTeacherSchoolCode(teacher?.schoolCode);
      if (cancelled) return;

      resolvedSchoolCodeRef.current =
        normalizeIdentifier(resolvedSchoolCode) || normalizeIdentifier(cachedSchoolCode);

      const activeSchoolCode = resolvedSchoolCodeRef.current;
      const rtdbBase = activeSchoolCode ? buildSchoolRtdbBase(activeSchoolCode) : getRtdbRoot();
      const activePostsCacheKey = buildPostsCacheKey(activeSchoolCode, teacher.userId);
      const activeMessagesCacheKey = buildMessagesCacheKey(activeSchoolCode, teacher.userId);

      const now = Date.now();
      const cachedMessageContacts = Array.isArray(cachedMessages)
        ? cachedMessages
            .map((conversation) => ({
              userId: normalizeIdentifier(conversation?.contact?.userId),
              name: conversation?.displayName,
              profileImage: conversation?.profile,
              type: conversation?.contact?.type,
            }))
            .filter((contact) => contact.userId)
        : [];

      const hasLoadedPosts = lastPostsRefreshAtRef.current > 0 || Array.isArray(cachedPosts);
      const hasLoadedMessages = lastMessagesRefreshAtRef.current > 0 || Array.isArray(cachedMessages);
      const shouldFetchPosts =
        settingsPreferences.emailAlerts &&
        (forcePosts || !hasLoadedPosts || now - lastPostsRefreshAtRef.current >= POSTS_SESSION_TTL_MS);
      const shouldFetchMessages =
        settingsPreferences.pushAlerts &&
        (forceMessages ||
          !hasLoadedMessages ||
          (cachedMessageContacts.length > 0 && now - lastMessagesRefreshAtRef.current >= MESSAGES_SESSION_TTL_MS));

      if (!shouldFetchPosts && !shouldFetchMessages) {
        return;
      }

      if (notificationRefreshPromiseRef.current) {
        await notificationRefreshPromiseRef.current;
        return;
      }

      const refreshTask = (async () => {
        try {
          const [postsRaw, messageConversationsRaw] = await Promise.all([
            shouldFetchPosts
              ? fetch(
                  `${API_BASE}/get_posts?viewerRole=teacher${activeSchoolCode ? `&schoolCode=${encodeURIComponent(activeSchoolCode)}` : ""}`,
                  {
                    headers: activeSchoolCode ? { "X-School-Code": activeSchoolCode } : {},
                  }
                )
                  .then((response) => response.json())
                  .catch(() => [])
              : Promise.resolve(null),
            shouldFetchMessages
              ? fetchTeacherConversationSummaries({
                  rtdbBase,
                  schoolCode: activeSchoolCode,
                  teacherUserId: teacher.userId,
                  unreadOnly: true,
                  limit: 5,
                  contactCandidates: forceMessages ? [] : cachedMessageContacts,
                  force: forceMessages,
                })
              : Promise.resolve(null),
          ]);

          if (cancelled) return;

          if (shouldFetchPosts) {
            const seenPosts = readSeenPosts(teacher.userId);
            const posts = normalizeToList(postsRaw)
              .slice()
              .sort((a, b) => {
                const first = a?.time ? new Date(a.time).getTime() : 0;
                const second = b?.time ? new Date(b.time).getTime() : 0;
                return second - first;
              })
              .filter((post) => post?.postId && !seenPosts.includes(post.postId))
              .slice(0, 5)
              .map((post) => ({
                id: post.postId,
                title: post.message?.substring(0, 50) || "Untitled post",
                adminName: post.adminName || "Admin",
                adminProfile: resolveProfileImage(post.adminProfile),
              }));

            writeSessionResource(activePostsCacheKey, posts);
            lastPostsRefreshAtRef.current = Date.now();
            if (!cancelled) {
              setPostNotifications(settingsPreferences.emailAlerts ? posts : []);
            }
          }

          if (shouldFetchMessages) {
            const messageConversations = Array.isArray(messageConversationsRaw) ? messageConversationsRaw : [];
            writeSessionResource(activeMessagesCacheKey, messageConversations);
            lastMessagesRefreshAtRef.current = Date.now();
            if (!cancelled) {
              applyVisibleMessages(messageConversations, settingsPreferences.pushAlerts);
            }
          }
        } finally {
          notificationRefreshPromiseRef.current = null;
        }
      })();

      notificationRefreshPromiseRef.current = refreshTask;
      await refreshTask;
    };

    const needsInitialRefresh =
      showNotifications ||
      (settingsPreferences.emailAlerts && lastPostsRefreshAtRef.current === 0) ||
      (settingsPreferences.pushAlerts && lastMessagesRefreshAtRef.current === 0);

    if (needsInitialRefresh) {
      void notificationRefreshRef.current({
        reason: showNotifications ? "panel-open" : "mount",
        forcePosts: showNotifications,
        forceMessages: showNotifications,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    settingsPreferences.emailAlerts,
    settingsPreferences.pushAlerts,
    showNotifications,
    teacher?.userId,
    teacher?.schoolCode,
  ]);

  useEffect(() => {
    if (!teacher?.userId) {
      return undefined;
    }

    const markTeacherInteraction = () => {
      lastTeacherInteractionAtRef.current = Date.now();
    };

    const handleFocus = () => {
      markTeacherInteraction();
      void notificationRefreshRef.current({ reason: "focus", forceMessages: true });
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      markTeacherInteraction();
      void notificationRefreshRef.current({ reason: "visible", forceMessages: true });
    };

    const handleOnline = () => {
      markTeacherInteraction();
      void notificationRefreshRef.current({ reason: "online", forcePosts: true, forceMessages: true });
    };

    const intervalId = window.setInterval(() => {
      void notificationRefreshRef.current({ reason: "passive" });
    }, NOTIFICATION_PASSIVE_CHECK_MS);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pointerdown", markTeacherInteraction, { passive: true });
    window.addEventListener("touchstart", markTeacherInteraction, { passive: true });
    window.addEventListener("keydown", markTeacherInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pointerdown", markTeacherInteraction);
      window.removeEventListener("touchstart", markTeacherInteraction);
      window.removeEventListener("keydown", markTeacherInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [teacher?.userId]);

  const profileImage = resolveProfileImage(
    teacher?.profileImage,
    teacher?.profile,
    teacher?.avatar
  );

  useEffect(() => {
    writeCachedTeacherProfileImage(String(teacher?.userId || "").trim(), profileImage);
  }, [teacher?.userId, profileImage]);

  return (
    <TeacherSidebarPersistenceContext.Provider value={!hidePersistentSidebar}>
      <div
        className="teacher-layout-active"
        style={{
          "--sidebar-width": hidePersistentSidebar ? "0px" : "clamp(230px, 16vw, 290px)",
        }}
      >
        <TeacherTopbar title="Gojo Teacher Portal">
          <TeacherTopbarActions
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            notificationCount={postNotifications.length + messageCount}
            postNotifications={postNotifications}
            messageNotifications={messageNotifications}
            onPostClick={(post) => {
              writeSeenPost(teacher?.userId, post?.id);
              setPostNotifications((previousNotifications) =>
                previousNotifications.filter((notification) => notification.id !== post?.id)
              );
              if (location.pathname !== "/dashboard") {
                navigate("/dashboard");
              }
            }}
            onMessageClick={(message) => {
              navigate("/all-chat", {
                state: {
                  contact: {
                    userId: message?.userId,
                    name: message?.displayName,
                    profileImage: message?.profile,
                  },
                  chatId: message?.chatId,
                },
              });
            }}
            onOpenMessages={() => navigate("/all-chat")}
            messageCount={messageCount}
            settingsTo="/settings"
            profileImage={profileImage}
            profileName={teacher?.name || teacher?.username || teacher?.teacherId || "Teacher"}
          />
        </TeacherTopbar>

        {!hidePersistentSidebar ? (
          <Sidebar
            persistent={true}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            teacher={teacher}
            handleLogout={() => {
              localStorage.removeItem("teacher");
              navigate("/login", { replace: true });
            }}
          />
        ) : null}

        <Outlet />
      </div>
    </TeacherSidebarPersistenceContext.Provider>
  );
}
