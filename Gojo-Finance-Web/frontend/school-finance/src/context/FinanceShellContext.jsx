import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { fetchConversationSummaries, markConversationAsSeen } from "../utils/chatRtdb";
import { getFinanceDbRoot, readStoredFinanceSession } from "../utils/financeSession";
import { loadScopedPosts } from "../utils/postData";

const FinanceShellContext = createContext(null);

const ACTIVE_REFRESH_MS = 60 * 1000;
const ACTIVE_GRACE_MS = 60 * 1000;

function buildUnreadSenderMap(summaries) {
  const nextMap = {};

  (summaries || []).forEach((summary) => {
    if (!summary || Number(summary.unreadCount || 0) <= 0) return;

    nextMap[summary.userId] = {
      userId: summary.userId,
      chatKey: summary.chatKey,
      type: summary.type || "user",
      name: summary.name || "User",
      profileImage: summary.profileImage || "/default-profile.png",
      count: Number(summary.unreadCount || 0),
      lastMessage: summary.lastMessage || null,
    };
  });

  return nextMap;
}

function normalizeUnreadPosts(posts, currentUserId) {
  if (!currentUserId) return [];

  return (posts || []).filter((post) => {
    const seenBy = post?.seenBy || {};
    return !seenBy?.[currentUserId];
  });
}

export function FinanceShellProvider({ children }) {
  const [session, setSession] = useState(() => readStoredFinanceSession());
  const [conversationSummaries, setConversationSummaries] = useState([]);
  const [unreadSenders, setUnreadSenders] = useState({});
  const [unreadPosts, setUnreadPosts] = useState([]);

  const lastInteractionAtRef = useRef(Date.now());

  const currentUserId = session.userId || "";
  const schoolCode = session.schoolCode || "";
  const dbRoot = useMemo(() => getFinanceDbRoot(schoolCode), [schoolCode]);

  const syncSessionFromStorage = useCallback(() => {
    setSession(readStoredFinanceSession());
  }, []);

  const refreshUnreadMessages = useCallback(
    async ({ force = false } = {}) => {
      if (!dbRoot || !currentUserId) {
        setConversationSummaries([]);
        setUnreadSenders({});
        return [];
      }

      const summaries = await fetchConversationSummaries({
        dbRoot,
        currentUserId,
        force,
      });

      setConversationSummaries(summaries);
      setUnreadSenders(buildUnreadSenderMap(summaries));
      return summaries;
    },
    [currentUserId, dbRoot]
  );

  const refreshUnreadPosts = useCallback(
    async ({ force = false } = {}) => {
      if (!currentUserId) {
        setUnreadPosts([]);
        return [];
      }

      const posts = await loadScopedPosts({ schoolCode, force }).catch(() => []);
      const unseenPosts = normalizeUnreadPosts(posts, currentUserId);
      setUnreadPosts(unseenPosts);
      return unseenPosts;
    },
    [currentUserId, schoolCode]
  );

  const refreshShell = useCallback(
    async ({ force = false } = {}) => {
      const [messages, posts] = await Promise.all([
        refreshUnreadMessages({ force }),
        refreshUnreadPosts({ force }),
      ]);

      return { messages, posts };
    },
    [refreshUnreadMessages, refreshUnreadPosts]
  );

  const markMessagesAsSeen = useCallback(
    async (userId) => {
      if (!dbRoot || !currentUserId || !userId) return;

      const summary = (conversationSummaries || []).find(
        (item) => String(item?.userId) === String(userId)
      );

      if (!summary?.chatKey) return;

      await markConversationAsSeen({
        dbRoot,
        currentUserId,
        chatKey: summary.chatKey,
      });

      setConversationSummaries((previous) =>
        previous.map((item) =>
          String(item?.userId) === String(userId)
            ? { ...item, unreadCount: 0 }
            : item
        )
      );

      setUnreadSenders((previous) => {
        const nextMap = { ...previous };
        delete nextMap[userId];
        return nextMap;
      });
    },
    [conversationSummaries, currentUserId, dbRoot]
  );

  const markPostAsSeen = useCallback(
    async (postId) => {
      if (!dbRoot || !currentUserId || !postId) return;

      await axios.put(`${dbRoot}/Posts/${postId}/seenBy/${currentUserId}.json`, true).catch(() => {});
      setUnreadPosts((previous) => previous.filter((post) => String(post?.postId) !== String(postId)));
    },
    [currentUserId, dbRoot]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromStorageEvent = (event) => {
      if (!event?.key || event.key === "finance" || event.key === "admin") {
        syncSessionFromStorage();
      }
    };

    window.addEventListener("storage", syncFromStorageEvent);
    return () => window.removeEventListener("storage", syncFromStorageEvent);
  }, [syncSessionFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("touchstart", markInteraction, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
    };
  }, []);

  useEffect(() => {
    syncSessionFromStorage();
  }, [syncSessionFromStorage]);

  useEffect(() => {
    if (!currentUserId) {
      setConversationSummaries([]);
      setUnreadSenders({});
      setUnreadPosts([]);
      return;
    }

    refreshShell({ force: false });
  }, [currentUserId, refreshShell]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || !currentUserId) {
      return undefined;
    }

    const refreshIfActive = () => {
      if (document.hidden) return;
      if (Date.now() - lastInteractionAtRef.current > ACTIVE_GRACE_MS) return;
      refreshShell({ force: false });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      lastInteractionAtRef.current = Date.now();
      refreshShell({ force: true });
    };

    const handleFocus = () => {
      lastInteractionAtRef.current = Date.now();
      refreshShell({ force: true });
    };

    const intervalId = window.setInterval(refreshIfActive, ACTIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUserId, refreshShell]);

  const messageCount = useMemo(
    () => Object.values(unreadSenders || {}).reduce((total, sender) => total + Number(sender?.count || 0), 0),
    [unreadSenders]
  );

  const totalNotifications = Number(unreadPosts?.length || 0) + messageCount;

  const contextValue = useMemo(
    () => ({
      session,
      dbRoot,
      currentUserId,
      conversationSummaries,
      unreadSenders,
      setUnreadSenders,
      unreadPosts,
      setUnreadPosts,
      messageCount,
      totalNotifications,
      fetchUnreadMessages: refreshUnreadMessages,
      fetchUnreadPosts: refreshUnreadPosts,
      refreshShell,
      markMessagesAsSeen,
      markPostAsSeen,
    }),
    [
      conversationSummaries,
      currentUserId,
      dbRoot,
      markMessagesAsSeen,
      markPostAsSeen,
      messageCount,
      refreshShell,
      refreshUnreadMessages,
      refreshUnreadPosts,
      session,
      totalNotifications,
      unreadPosts,
      unreadSenders,
    ]
  );

  return <FinanceShellContext.Provider value={contextValue}>{children}</FinanceShellContext.Provider>;
}

export function useFinanceShell() {
  return useContext(FinanceShellContext);
}