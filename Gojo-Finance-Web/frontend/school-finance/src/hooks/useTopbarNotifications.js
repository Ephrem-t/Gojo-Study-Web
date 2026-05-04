import { useState } from "react";
import { useFinanceShell } from "../context/FinanceShellContext";

export const NOTIFICATION_POLL_MS = 60000;

export default function useTopbarNotifications() {
  const shell = useFinanceShell();
  const [fallbackSenders, setFallbackSenders] = useState({});
  const [fallbackPosts, setFallbackPosts] = useState([]);

  if (shell) {
    return shell;
  }

  return {
    unreadSenders: fallbackSenders,
    setUnreadSenders: setFallbackSenders,
    unreadPosts: fallbackPosts,
    setUnreadPosts: setFallbackPosts,
    messageCount: 0,
    totalNotifications: 0,
    fetchUnreadMessages: async () => [],
    fetchUnreadPosts: async () => [],
    markMessagesAsSeen: async () => {},
    markPostAsSeen: async () => {},
    conversationSummaries: [],
  };
}
