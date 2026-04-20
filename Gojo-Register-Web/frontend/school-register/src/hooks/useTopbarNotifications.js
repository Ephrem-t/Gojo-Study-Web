import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getSafeProfileImage } from "../utils/chatRtdb";
import { fetchConversationSummaries, loadUserRecordById, normalizeIdentifier } from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

export const NOTIFICATION_POLL_MS = 60000;

const RECENT_POST_LIMIT = 25;

export const RegisterNotificationsContext = createContext(null);

const buildUnreadSendersFromSummaries = (summaries = []) => {
  return (summaries || []).reduce((result, summary) => {
    const contactUserId = normalizeIdentifier(summary?.contact?.userId || summary?.otherUserId);
    if (!contactUserId || Number(summary?.unreadForMe || 0) <= 0) {
      return result;
    }

    result[contactUserId] = {
      type: summary?.contact?.type || "user",
      name: summary?.contact?.name || summary?.displayName || contactUserId,
      profileImage: getSafeProfileImage(summary?.contact?.profileImage),
      count: Number(summary?.unreadForMe || 0),
    };
    return result;
  }, {});
};

export default function useTopbarNotifications({ dbRoot, currentUserId, pollMs = NOTIFICATION_POLL_MS, enabled = true }) {
  const sharedNotifications = useContext(RegisterNotificationsContext);
  const [unreadSenders, setUnreadSenders] = useState({});
  const [unreadPosts, setUnreadPosts] = useState([]);
  const refreshInFlightRef = useRef(null);

  const shouldUseLocalFetcher = enabled && !sharedNotifications;

  const fetchUnreadMessages = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadSenders({});
      return;
    }

    if (!shouldUseLocalFetcher) {
      return;
    }

    try {
      const summaries = await fetchConversationSummaries({
        rtdbBase: dbRoot,
        currentUserId,
        unreadOnly: true,
        includeWithoutLastMessage: true,
        limit: 20,
      });
      setUnreadSenders(buildUnreadSendersFromSummaries(summaries));
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  }, [currentUserId, dbRoot, shouldUseLocalFetcher]);

  const fetchUnreadPosts = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadPosts([]);
      return;
    }

    if (!shouldUseLocalFetcher) {
      return;
    }

    try {
      const postsNode = await fetchCachedJson(
        `${dbRoot}/Posts.json?orderBy=%22%24key%22&limitToLast=${RECENT_POST_LIMIT}`,
        {
          ttlMs: 20 * 1000,
          fallbackValue: {},
        }
      );

      const unreadCandidates = Object.entries(postsNode || {})
        .map(([postId, postValue]) => ({ postId, ...postValue }))
        .filter((postValue) => postValue && typeof postValue === "object")
        .filter((postValue) => !postValue?.seenBy || !postValue.seenBy[currentUserId])
        .sort(
          (leftPost, rightPost) =>
            new Date(rightPost.time || rightPost.createdAt || 0).getTime() -
            new Date(leftPost.time || leftPost.createdAt || 0).getTime()
        )
        .slice(0, RECENT_POST_LIMIT);

      const enrichedPosts = await Promise.all(
        unreadCandidates.map(async (postValue) => {
          let posterRecord = null;
          const posterUserId = normalizeIdentifier(postValue?.userId);

          if (posterUserId) {
            posterRecord = await loadUserRecordById({
              rtdbBase: dbRoot,
              userId: posterUserId,
            });
          }

          return {
            ...postValue,
            notificationId: postValue?.notificationId || postValue?.postId,
            adminName: postValue?.adminName || posterRecord?.name || "Admin",
            adminProfile: getSafeProfileImage(
              postValue?.adminProfile ||
                postValue?.adminProfileImage ||
                postValue?.profileImage ||
                posterRecord?.profileImage
            ),
          };
        })
      );

      setUnreadPosts(enrichedPosts);
    } catch (err) {
      console.error("Post notification fetch failed:", err);
      setUnreadPosts([]);
    }
  }, [currentUserId, dbRoot, shouldUseLocalFetcher]);

  const refreshNotifications = useCallback(async () => {
    if (!dbRoot || !currentUserId || !shouldUseLocalFetcher) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const request = Promise.all([fetchUnreadMessages(), fetchUnreadPosts()]).finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = request;
    return request;
  }, [currentUserId, dbRoot, fetchUnreadMessages, fetchUnreadPosts, shouldUseLocalFetcher]);

  useEffect(() => {
    if (!shouldUseLocalFetcher || !dbRoot || !currentUserId) return undefined;

    const runRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      refreshNotifications();
    };

    runRefresh();

    const intervalId = pollMs > 0 ? window.setInterval(runRefresh, pollMs) : null;
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [currentUserId, dbRoot, pollMs, refreshNotifications, shouldUseLocalFetcher]);

  const markMessagesAsSeen = useCallback(
    async (userId) => {
      if (!dbRoot || !currentUserId || !userId) return;

      const summaries = await fetchConversationSummaries({
        rtdbBase: dbRoot,
        currentUserId,
        contactCandidates: [{ userId }],
        includeWithoutLastMessage: true,
        limit: 1,
        force: true,
      });
      const chatId = summaries[0]?.chatId;
      if (!chatId) {
        return;
      }

      await axios.patch(`${dbRoot}/Chats/${encodeURIComponent(chatId)}/unread.json`, {
        [currentUserId]: 0,
      });

      setUnreadSenders((prev) => {
        const nextValue = { ...prev };
        delete nextValue[normalizeIdentifier(userId)];
        return nextValue;
      });
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

  if (sharedNotifications) {
    return sharedNotifications;
  }

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
