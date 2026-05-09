import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  buildOwnerChatSummariesPath,
  DEFAULT_PROFILE_IMAGE,
  fetchJson,
  getSafeProfileImage,
  getConversationSortTime,
  inferContactTypeFromUser,
  mapInBatches,
  normalizeChatSummaryValue,
  uniqueNonEmptyValues,
} from "../utils/chatRtdb";

export const NOTIFICATION_POLL_MS = 3 * 60 * 1000;
const NOTIFICATION_IDLE_GRACE_MS = 5 * 60 * 1000;

const RECENT_POST_LIMIT = 25;

const getUserLookupQueryUrl = (dbRoot, userId) => {
  const encodedUserId = encodeURIComponent(String(userId || "").trim());
  return `${dbRoot}/Users.json?orderBy=%22userId%22&equalTo=%22${encodedUserId}%22&limitToFirst=1`;
};

const pickResolvedUserRecord = (directRecord, queriedUsers) => {
  if (directRecord && typeof directRecord === "object") {
    const hasMeaningfulData = Object.keys(directRecord).length > 0;
    if (hasMeaningfulData) {
      return directRecord;
    }
  }

  const matchedEntry = Object.values(queriedUsers || {}).find(
    (userRecord) => userRecord && typeof userRecord === "object"
  );

  return matchedEntry || null;
};

export default function useTopbarNotifications({
  dbRoot,
  currentUserId,
  pollMs = NOTIFICATION_POLL_MS,
  enabled = true,
}) {
  const [unreadSenders, setUnreadSenders] = useState({});
  const [unreadPosts, setUnreadPosts] = useState([]);
  const userCacheRef = useRef(new Map());
  const pendingUserLookupsRef = useRef(new Map());
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

  const resolveUserRecord = useCallback(
    async (userId) => {
      const normalizedUserId = String(userId || "").trim();
      if (!dbRoot || !normalizedUserId) {
        return null;
      }

      const cachedUser = userCacheRef.current.get(normalizedUserId);
      if (cachedUser) {
        return cachedUser;
      }

      const pendingLookup = pendingUserLookupsRef.current.get(normalizedUserId);
      if (pendingLookup) {
        return pendingLookup;
      }

      const lookupPromise = (async () => {
        const encodedUserId = encodeURIComponent(normalizedUserId);
        const [directRecord, queriedUsers] = await Promise.all([
          fetchJson(`${dbRoot}/Users/${encodedUserId}.json`, null),
          fetchJson(getUserLookupQueryUrl(dbRoot, normalizedUserId), {}),
        ]);

        const resolvedRecord = pickResolvedUserRecord(directRecord, queriedUsers);
        if (resolvedRecord) {
          userCacheRef.current.set(normalizedUserId, resolvedRecord);
        }

        return resolvedRecord;
      })();

      pendingUserLookupsRef.current.set(normalizedUserId, lookupPromise);

      try {
        return await lookupPromise;
      } finally {
        pendingUserLookupsRef.current.delete(normalizedUserId);
      }
    },
    [dbRoot]
  );

  const fetchUnreadMessages = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadSenders({});
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const ownerSummaries = await fetchJson(
        `${dbRoot}/${buildOwnerChatSummariesPath(currentUserId)}.json`,
        {}
      );
      const summaryEntries = Object.entries(ownerSummaries && typeof ownerSummaries === "object" ? ownerSummaries : {})
        .map(([chatId, summaryValue]) => normalizeChatSummaryValue(summaryValue, { chatId }))
        .filter((summary) => summary.otherUserId && summary.unreadCount > 0);

      if (summaryEntries.length === 0) {
        setUnreadSenders({});
        return;
      }

      const senderEntries = await mapInBatches(summaryEntries, 16, async (summary) => {
        const userRecord = await resolveUserRecord(summary.otherUserId);
        return {
          otherUserId: summary.otherUserId,
          unreadCount: summary.unreadCount,
          userRecord,
          lastMessageTime: getConversationSortTime(summary.lastMessageTime),
        };
      });

      const nextSenders = senderEntries
        .filter(Boolean)
        .sort((leftEntry, rightEntry) => Number(rightEntry.lastMessageTime || 0) - Number(leftEntry.lastMessageTime || 0))
        .reduce((accumulator, entry) => {
          const userRecord = entry.userRecord || {};
          accumulator[entry.otherUserId] = {
            type: inferContactTypeFromUser(userRecord),
            name:
              userRecord?.name ||
              userRecord?.username ||
              entry.otherUserId,
            profileImage: getSafeProfileImage(userRecord?.profileImage, DEFAULT_PROFILE_IMAGE),
            count: entry.unreadCount,
          };
          return accumulator;
        }, {});

      setUnreadSenders(nextSenders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  }, [currentUserId, dbRoot, enabled, resolveUserRecord]);

  const fetchUnreadPosts = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadPosts([]);
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const postsNode = await fetchJson(
        `${dbRoot}/Posts.json?orderBy=%22%24key%22&limitToLast=${RECENT_POST_LIMIT}`,
        {}
      );

      const recentUnreadPosts = Object.entries(postsNode || {})
        .map(([postId, postValue]) => ({ postId, ...postValue }))
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
  }, [currentUserId, dbRoot, enabled]);

  const refreshNotifications = useCallback(async ({ reason = "active" } = {}) => {
    if (!dbRoot || !currentUserId) {
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
  }, [currentUserId, dbRoot, fetchUnreadMessages, fetchUnreadPosts]);

  useEffect(() => {
    if (!enabled || !dbRoot || !currentUserId) return undefined;

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
  }, [currentUserId, dbRoot, enabled, pollMs, refreshNotifications]);

  const markMessagesAsSeen = useCallback(
    async (userId) => {
      if (!dbRoot || !currentUserId || !userId) return;

      const updates = {};
      const collectUpdates = (chatKey, data) => {
        Object.entries(data || {}).forEach(([msgId, msg]) => {
          if (String(msg?.receiverId) === String(currentUserId) && !msg?.seen) {
            updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
          }
        });
      };

      const candidateChatKeys = uniqueNonEmptyValues(buildChatKeyCandidates(currentUserId, userId));
      const messageSnapshots = await Promise.all(
        candidateChatKeys.map(async (chatKey) => ({
          chatKey,
          messages: await fetchJson(`${dbRoot}/Chats/${encodeURIComponent(chatKey)}/messages.json`, null),
        }))
      );

      messageSnapshots.forEach(({ chatKey, messages }) => {
        collectUpdates(chatKey, messages);
      });

      if (Object.keys(updates).length > 0) {
        await axios.patch(`${dbRoot}/.json`, updates);
      }
    },
    [dbRoot, currentUserId]
  );

  const markPostAsSeen = useCallback(
    async (postId) => {
      if (!dbRoot || !currentUserId || !postId) return;
      await axios.put(`${dbRoot}/Posts/${postId}/seenBy/${currentUserId}.json`, true);
      setUnreadPosts((prev) => prev.filter((post) => String(post?.postId) !== String(postId)));
    },
    [dbRoot, currentUserId]
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
