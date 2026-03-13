import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

export const NOTIFICATION_POLL_MS = 9000;

export default function useTopbarNotifications({ dbRoot, currentUserId, pollMs = NOTIFICATION_POLL_MS }) {
  const [unreadSenders, setUnreadSenders] = useState({});
  const [unreadPosts, setUnreadPosts] = useState([]);

  const fetchUnreadMessages = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadSenders({});
      return;
    }

    const senders = {};

    try {
      const usersRes = await axios.get(`${dbRoot}/Users.json`).catch(() => ({ data: {} }));
      const usersData = usersRes.data || {};
      const findUserByUserId = (userId) =>
        Object.values(usersData).find((u) => String(u?.userId) === String(userId));

      const getUnreadCount = async (userId) => {
        if (!userId) return 0;

        const key1 = `${currentUserId}_${userId}`;
        const key2 = `${userId}_${currentUserId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`${dbRoot}/Chats/${key1}/messages.json`).catch(() => ({ data: null })),
          axios.get(`${dbRoot}/Chats/${key2}/messages.json`).catch(() => ({ data: null })),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];
        return msgs.filter((m) => String(m?.receiverId) === String(currentUserId) && !m?.seen).length;
      };

      const [teachersRes, studentsRes, parentsRes] = await Promise.all([
        axios.get(`${dbRoot}/Teachers.json`).catch(() => ({ data: {} })),
        axios.get(`${dbRoot}/Students.json`).catch(() => ({ data: {} })),
        axios.get(`${dbRoot}/Parents.json`).catch(() => ({ data: {} })),
      ]);

      for (const key in teachersRes.data || {}) {
        const teacher = teachersRes.data[key];
        const unread = await getUnreadCount(teacher?.userId);
        if (unread > 0) {
          const user = findUserByUserId(teacher?.userId);
          senders[teacher.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      for (const key in studentsRes.data || {}) {
        const student = studentsRes.data[key];
        const unread = await getUnreadCount(student?.userId);
        if (unread > 0) {
          const user = findUserByUserId(student?.userId);
          senders[student.userId] = {
            type: "student",
            name: user?.name || student?.name || "Student",
            profileImage: user?.profileImage || student?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      for (const key in parentsRes.data || {}) {
        const parent = parentsRes.data[key];
        const unread = await getUnreadCount(parent?.userId);
        if (unread > 0) {
          const user = findUserByUserId(parent?.userId);
          senders[parent.userId] = {
            type: "parent",
            name: user?.name || parent?.name || "Parent",
            profileImage: user?.profileImage || parent?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  }, [dbRoot, currentUserId]);

  const fetchUnreadPosts = useCallback(async () => {
    if (!dbRoot || !currentUserId) {
      setUnreadPosts([]);
      return;
    }

    try {
      const postsRes = await axios.get(`${dbRoot}/Posts.json`).catch(() => ({ data: {} }));
      const postsNode = postsRes.data || {};
      const allPosts = Object.entries(postsNode).map(([postId, post]) => ({ postId, ...post }));
      const unread = allPosts.filter((p) => !p?.seenBy || !p.seenBy[currentUserId]);

      if (unread.length === 0) {
        setUnreadPosts([]);
        return;
      }

      const usersRes = await axios.get(`${dbRoot}/Users.json`).catch(() => ({ data: {} }));
      const usersData = usersRes.data || {};

      const enriched = await Promise.all(
        unread.map(async (post) => {
          let profile = "/default-profile.png";

          try {
            const financeNode = post?.adminId
              ? (await axios.get(`${dbRoot}/Finance/${post.adminId}.json`).catch(() => ({ data: null }))).data
              : null;
            const schoolAdminNode = !financeNode && post?.adminId
              ? (await axios.get(`${dbRoot}/School_Admins/${post.adminId}.json`).catch(() => ({ data: null }))).data
              : null;

            const posterUserId = financeNode?.userId || schoolAdminNode?.userId || post?.userId;
            if (posterUserId) {
              const posterUser =
                Object.values(usersData).find((u) => String(u?.userId) === String(posterUserId)) ||
                usersData[posterUserId];
              profile = posterUser?.profileImage || profile;
            }
          } catch {
            // keep fallback image
          }

          return {
            ...post,
            notificationId: post?.notificationId || post?.postId,
            adminName: post?.adminName || "Admin",
            adminProfile: profile,
          };
        })
      );

      setUnreadPosts(enriched);
    } catch (err) {
      console.error("Post notification fetch failed:", err);
      setUnreadPosts([]);
    }
  }, [dbRoot, currentUserId]);

  useEffect(() => {
    if (!dbRoot || !currentUserId) return;

    fetchUnreadMessages();
    const messageInterval = setInterval(fetchUnreadMessages, pollMs);
    return () => clearInterval(messageInterval);
  }, [dbRoot, currentUserId, pollMs, fetchUnreadMessages]);

  useEffect(() => {
    if (!dbRoot || !currentUserId) return;

    fetchUnreadPosts();
    const postInterval = setInterval(fetchUnreadPosts, pollMs);
    return () => clearInterval(postInterval);
  }, [dbRoot, currentUserId, pollMs, fetchUnreadPosts]);

  const markMessagesAsSeen = useCallback(
    async (userId) => {
      if (!dbRoot || !currentUserId || !userId) return;

      const key1 = `${currentUserId}_${userId}`;
      const key2 = `${userId}_${currentUserId}`;

      const [r1, r2] = await Promise.all([
        axios.get(`${dbRoot}/Chats/${key1}/messages.json`).catch(() => ({ data: null })),
        axios.get(`${dbRoot}/Chats/${key2}/messages.json`).catch(() => ({ data: null })),
      ]);

      const updates = {};
      const collectUpdates = (data, basePath) => {
        Object.entries(data || {}).forEach(([msgId, msg]) => {
          if (String(msg?.receiverId) === String(currentUserId) && !msg?.seen) {
            updates[`${basePath}/${msgId}/seen`] = true;
          }
        });
      };

      collectUpdates(r1.data, `Chats/${key1}/messages`);
      collectUpdates(r2.data, `Chats/${key2}/messages`);

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
    markMessagesAsSeen,
    markPostAsSeen,
  };
}
