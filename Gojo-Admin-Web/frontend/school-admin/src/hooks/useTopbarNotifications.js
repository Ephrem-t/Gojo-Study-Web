import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_BASE } from "../config.js";
import {
  DEFAULT_PROFILE_IMAGE,
  getSafeProfileImage,
  inferContactTypeFromUser,
} from "../utils/chatRtdb";

export const NOTIFICATION_POLL_MS = 3 * 60 * 1000;
const NOTIFICATION_IDLE_GRACE_MS = 5 * 60 * 1000;

const RECENT_POST_LIMIT = 25;

const readAdminSession = () => {
  const keys = ["admin", "gojo_admin"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore malformed localStorage data.
    }
  }
  return {};
};

const readSchoolCode = () => String(readAdminSession()?.schoolCode || "").trim();

export default function useTopbarNotifications({
  dbRoot,
  currentUserId,
  pollMs = NOTIFICATION_POLL_MS,
  enabled = true,
}) {
  const [unreadSenders, setUnreadSenders] = useState({});
  const [unreadPosts, setUnreadPosts] = useState([]);
  const notificationRefreshPromiseRef = useRef(null);
  const lastInteractionAtRef = useRef(Date.now());

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      markInteraction();
    };

    window.addEventListener("focus", markInteraction);
    window.addEventListener("online", markInteraction);
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", markInteraction);
      window.removeEventListener("online", markInteraction);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fetchUnreadMessages = useCallback(async () => {
    if (!currentUserId) {
      setUnreadSenders({});
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const unreadRes = await axios.get(`${BACKEND_BASE}/api/unread_messages/${encodeURIComponent(currentUserId)}`);
      const unreadMessages = Array.isArray(unreadRes?.data?.messages) ? unreadRes.data.messages : [];
      const countsBySender = unreadMessages.reduce((acc, message) => {
        const senderId = String(message?.senderId || "").trim();
        if (!senderId) return acc;
        acc[senderId] = (acc[senderId] || 0) + 1;
        return acc;
      }, {});

      const senderIds = Object.keys(countsBySender);
      if (senderIds.length === 0) {
        setUnreadSenders({});
        return;
      }

      const usersRes = await axios.get(`${BACKEND_BASE}/api/users_lookup`, {
        params: {
          schoolCode: readSchoolCode(),
          userIds: senderIds.join(","),
        },
      });
      const usersById = (usersRes?.data?.users && typeof usersRes.data.users === "object") ? usersRes.data.users : {};

      const nextSenders = senderIds.reduce((accumulator, senderId) => {
        const userRecord = usersById[senderId] || {};
        accumulator[senderId] = {
          type: inferContactTypeFromUser(userRecord),
          name: userRecord?.name || userRecord?.username || senderId,
          profileImage: getSafeProfileImage(userRecord?.profileImage, DEFAULT_PROFILE_IMAGE),
          count: Number(countsBySender[senderId] || 0),
        };
        return accumulator;
      }, {});

      setUnreadSenders(nextSenders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  }, [currentUserId, enabled]);

  const fetchUnreadPosts = useCallback(async () => {
    if (!currentUserId) {
      setUnreadPosts([]);
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const postsResponse = await axios.get(`${BACKEND_BASE}/api/get_posts`, {
        params: {
          schoolCode: readSchoolCode(),
          limit: RECENT_POST_LIMIT,
        },
      });
      const sourcePosts = Array.isArray(postsResponse?.data) ? postsResponse.data : [];

      const recentUnreadPosts = sourcePosts
        .filter((postValue) => postValue && typeof postValue === "object")
        .filter((postValue) => !postValue?.seenBy || !postValue.seenBy[currentUserId])
        .sort(
          (leftPost, rightPost) =>
            new Date(rightPost.time || rightPost.createdAt || 0).getTime() -
            new Date(leftPost.time || leftPost.createdAt || 0).getTime()
        )
        .slice(0, RECENT_POST_LIMIT)
        .map((postValue) => ({
          ...postValue,
          notificationId: postValue?.notificationId || postValue?.postId,
          adminName: postValue?.adminName || "Admin",
          adminProfile: getSafeProfileImage(
            postValue?.adminProfile || postValue?.adminProfileImage || postValue?.profileImage,
            DEFAULT_PROFILE_IMAGE
          ),
        }));

      setUnreadPosts(recentUnreadPosts);
    } catch (err) {
      console.error("Post notification fetch failed:", err);
      setUnreadPosts([]);
    }
  }, [currentUserId, enabled]);

  const refreshNotifications = useCallback(async ({ reason = "active" } = {}) => {
    if (!currentUserId) {
      return;
    }

    const isVisible = typeof document === "undefined" || document.visibilityState === "visible";
    const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
    const recentInteraction = Date.now() - lastInteractionAtRef.current < NOTIFICATION_IDLE_GRACE_MS;
    const isUserDriven = reason !== "passive";

    if (!isUserDriven && (!isVisible || !isOnline || !recentInteraction)) {
      return;
    }

    if (notificationRefreshPromiseRef.current) {
      return notificationRefreshPromiseRef.current;
    }

    const refreshPromise = Promise.all([fetchUnreadMessages(), fetchUnreadPosts()]).finally(() => {
      if (notificationRefreshPromiseRef.current === refreshPromise) {
        notificationRefreshPromiseRef.current = null;
      }
    });

    notificationRefreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [currentUserId, fetchUnreadMessages, fetchUnreadPosts]);

  useEffect(() => {
    if (!enabled || !currentUserId) return undefined;

    const runFocusedRefresh = () => {
      lastInteractionAtRef.current = Date.now();
      void refreshNotifications({ reason: "active" });
    };

    const runPassiveRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      void refreshNotifications({ reason: "passive" });
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      runFocusedRefresh();
    };

    runFocusedRefresh();

    const intervalId = pollMs > 0 ? window.setInterval(runPassiveRefresh, pollMs) : null;
    window.addEventListener("focus", runFocusedRefresh);
    window.addEventListener("online", runFocusedRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("focus", runFocusedRefresh);
      window.removeEventListener("online", runFocusedRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserId, enabled, pollMs, refreshNotifications]);

  const markMessagesAsSeen = useCallback(
    async (userId) => {
      if (!currentUserId || !userId) return;
      await axios.post(`${BACKEND_BASE}/api/mark_messages_read`, {
        adminId: currentUserId,
        senderId: userId,
      });
    },
    [currentUserId]
  );

  const markPostAsSeen = useCallback(
    async (postId) => {
      if (!currentUserId || !postId) return;
      await axios.post(`${BACKEND_BASE}/api/mark_post_seen`, {
        postId,
        userId: currentUserId,
      });
      setUnreadPosts((prev) => prev.filter((post) => String(post?.postId) !== String(postId)));
    },
    [currentUserId]
  );

  const messageCount = useMemo(
    () => Object.values(unreadSenders || {}).reduce((acc, sender) => acc + (sender?.count || 0), 0),
    [unreadSenders]
  );

  const totalNotifications = (unreadPosts?.length || 0) + messageCount;

  return {
    unreadSenders,
    setUnreadSenders,
    unreadPosts,
    setUnreadPosts,
    messageCount,
    totalNotifications,
    fetchUnreadMessages,
    fetchUnreadPosts,
    refreshNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  };
}
