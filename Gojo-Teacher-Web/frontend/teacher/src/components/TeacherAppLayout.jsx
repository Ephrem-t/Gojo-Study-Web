import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import TeacherTopbar from "./TeacherTopbar";
import TeacherTopbarActions from "./TeacherTopbarActions";
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
import { resolveProfileImage } from "../utils/profileImage";

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

const normalizeToList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
};

const writeCachedTeacherProfileImage = (teacherUserId, imageUrl) => {
  if (!teacherUserId || !imageUrl || imageUrl === "/default-profile.png") return;
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

export default function TeacherAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [teacher, setTeacher] = useState(() => readTeacherFromStorage());
  const [postNotifications, setPostNotifications] = useState([]);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    setTeacher(readTeacherFromStorage());
  }, [location.pathname]);

  useEffect(() => {
    const currentTeacher = readTeacherFromStorage();
    const teacherUserId = String(currentTeacher?.userId || "").trim();
    if (!teacherUserId) return;

    let cancelled = false;

    const hydrateTeacherProfile = async () => {
      try {
        const rtdbBase = getRtdbRoot();
        const schoolCode = String(currentTeacher?.schoolCode || "").trim();
        const urls = buildUsersLookupUrls(rtdbBase, schoolCode);

        let matchedUser = null;

        for (const url of urls) {
          try {
            const usersResponse = await fetch(url);
            const usersObj = (await usersResponse.json()) || {};
            if (usersObj && typeof usersObj === "object") {
              matchedUser =
                usersObj[teacherUserId] ||
                Object.entries(usersObj).find(([userKey, userItem]) =>
                  String(userKey || "").trim() === teacherUserId ||
                  String(userItem?.userId || "").trim() === teacherUserId
                )?.[1] ||
                null;
            }
            if (matchedUser) break;
          } catch (error) {
            // continue with next URL
          }
        }

        if (!matchedUser || cancelled) return;

        const mergedTeacher = {
          ...currentTeacher,
          ...matchedUser,
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
      return;
    }

    let cancelled = false;

    const refreshNotifications = async () => {
      try {
        const rtdbBase = getRtdbRoot();

        const [postsRaw, usersRaw, adminsRaw, chatsRaw] = await Promise.all([
          fetch(`${API_BASE}/get_posts`).then((response) => response.json()).catch(() => []),
          fetch(`${rtdbBase}/Users.json`).then((response) => response.json()).catch(() => ({})),
          fetch(`${rtdbBase}/School_Admins.json`).then((response) => response.json()).catch(() => ({})),
          fetch(`${rtdbBase}/Chats.json`).then((response) => response.json()).catch(() => ({})),
        ]);

        if (cancelled) return;

        const users = usersRaw || {};
        const schoolAdmins = adminsRaw || {};
        const chats = chatsRaw || {};
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
          .map((post) => {
            const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
            const adminRecord = adminId ? schoolAdmins[adminId] : null;
            const userRecord = adminRecord?.userId ? users[adminRecord.userId] : null;
            return {
              id: post.postId,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: userRecord?.name || adminRecord?.name || post.adminName || "Admin",
              adminProfile:
                resolveProfileImage(
                  userRecord?.profileImage,
                  userRecord?.profile,
                  adminRecord?.profileImage,
                  adminRecord?.profile,
                  post.adminProfile
                ),
            };
          });

        const messages = [];
        Object.entries(chats || {}).forEach(([chatId, chat]) => {
          const unreadForMe = Number(chat?.unread?.[teacher.userId]) || 0;
          if (!unreadForMe) return;

          const participants = chat?.participants || {};
          const otherKey = Object.keys(participants).find((participant) => participant !== teacher.userId);
          if (!otherKey) return;

          const directUser = users[otherKey] || null;
          const fallbackUser = Object.values(users).find((userRecord) => userRecord?.userId === otherKey) || null;
          const resolvedUser = directUser || fallbackUser || {};

          messages.push({
            chatId,
            userId: resolvedUser.userId || otherKey,
            displayName: resolvedUser.name || resolvedUser.username || otherKey,
            profile: resolveProfileImage(
              resolvedUser.profileImage,
              resolvedUser.profile,
              resolvedUser.avatar
            ),
            unreadForMe,
            title: unreadForMe > 1 ? `${unreadForMe} new messages` : "New message",
          });
        });

        if (!cancelled) {
          setPostNotifications(posts);
          setMessageNotifications(messages);
          setMessageCount(messages.reduce((sum, item) => sum + (item.unreadForMe || 0), 0));
        }
      } catch (error) {
        if (!cancelled) {
          setPostNotifications([]);
          setMessageNotifications([]);
          setMessageCount(0);
        }
      }
    };

    refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [teacher?.userId, teacher?.schoolCode]);

  const profileImage = resolveProfileImage(
    teacher?.profileImage,
    teacher?.profile,
    teacher?.avatar
  );

  useEffect(() => {
    writeCachedTeacherProfileImage(String(teacher?.userId || "").trim(), profileImage);
  }, [teacher?.userId, profileImage]);

  return (
    <div className="teacher-layout-active">
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
        />
      </TeacherTopbar>
      <Outlet />
    </div>
  );
}
