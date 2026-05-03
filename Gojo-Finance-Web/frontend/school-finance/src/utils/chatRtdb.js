import axios from "axios";
import { buildChatKey, normalizeUserType } from "./financeSession";
import { clearCachedValue, getOrLoad } from "./requestCache";

const CHAT_LIST_TTL_MS = 45 * 1000;
const USER_TTL_MS = 5 * 60 * 1000;

function getChatListKey(dbRoot, currentUserId) {
  return `finance:chat-list:${dbRoot}:${currentUserId}`;
}

function getChatMetaKey(dbRoot, chatKey) {
  return `finance:chat-meta:${dbRoot}:${chatKey}`;
}

function getUserKey(dbRoot, userId) {
  return `finance:user:${dbRoot}:${userId}`;
}

function getRoleKey(dbRoot, role) {
  return `finance:users-by-role:${dbRoot}:${role}`;
}

function getSchoolPeopleKey(dbRoot, role) {
  return `finance:school-people:${dbRoot}:${role}`;
}

function getManagedGradesKey(dbRoot) {
  return `finance:managed-grades:${dbRoot}`;
}

function parseChatParts(chatKey) {
  return String(chatKey || "")
    .split("_")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

function inferPeerUserId(chatKey, currentUserId, lastMessage) {
  const normalizedCurrentUserId = String(currentUserId || "");
  const parts = parseChatParts(chatKey);

  if (parts.length === 2 && parts.includes(normalizedCurrentUserId)) {
    return parts[0] === normalizedCurrentUserId ? parts[1] : parts[0];
  }

  const senderId = String(lastMessage?.senderId || "");
  const receiverId = String(lastMessage?.receiverId || "");

  if (senderId && senderId !== normalizedCurrentUserId) return senderId;
  if (receiverId && receiverId !== normalizedCurrentUserId) return receiverId;

  return "";
}

function findUserRecord(usersNode, userId) {
  if (!usersNode || !userId) return null;

  return (
    usersNode[userId] ||
    Object.values(usersNode).find((user) => String(user?.userId || "") === String(userId)) ||
    null
  );
}

function sortGradeValuesInternal(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))).sort(
    (left, right) => {
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      const leftIsNumber = Number.isFinite(leftNumber);
      const rightIsNumber = Number.isFinite(rightNumber);

      if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      if (leftIsNumber !== rightIsNumber) {
        return leftIsNumber ? -1 : 1;
      }

      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    }
  );
}

function toStudentContact(studentId, studentNode, usersNode) {
  const userId = studentNode?.userId || studentNode?.use || studentNode?.user || "";
  const user = findUserRecord(usersNode, userId) || {};

  return {
    id: studentId,
    studentId,
    userId,
    role: user?.role || "student",
    type: normalizeUserType(user?.role || "student"),
    name: user?.name || user?.username || studentNode?.name || studentNode?.username || `Student ${studentId}`,
    username: user?.username || studentNode?.username || "",
    email: user?.email || studentNode?.email || "",
    phone: user?.phone || user?.phoneNumber || studentNode?.phone || "",
    profileImage: user?.profileImage || studentNode?.profileImage || "/default-profile.png",
    grade: studentNode?.grade || "",
    section: studentNode?.section || "",
    parentLinks: studentNode?.parents || {},
  };
}

function toParentContact(parentId, parentNode, usersNode, studentsNode) {
  const userId = parentNode?.userId || "";
  const user = findUserRecord(usersNode, userId) || {};
  const childLinks = Object.values(parentNode?.children || {});
  const firstChild = childLinks[0] || null;
  const childStudentId = String(firstChild?.studentId || "");
  const childStudent = studentsNode?.[childStudentId] || null;
  const childUser = findUserRecord(
    usersNode,
    childStudent?.userId || childStudent?.use || childStudent?.user || ""
  ) || {};

  return {
    id: parentId,
    parentId,
    userId,
    role: user?.role || "parent",
    type: normalizeUserType(user?.role || "parent"),
    name: user?.name || user?.username || parentNode?.name || parentId || "Parent",
    username: user?.username || parentNode?.username || "",
    email: user?.email || parentNode?.email || "",
    phone: user?.phone || user?.phoneNumber || parentNode?.phone || "",
    profileImage: user?.profileImage || parentNode?.profileImage || "/default-profile.png",
    childName:
      childUser?.name || childUser?.username || childStudent?.name || childStudent?.username || "N/A",
    childRelationship: firstChild?.relationship || "N/A",
    children: parentNode?.children || {},
  };
}

async function loadChatMeta(dbRoot, chatKey, force = false) {
  return getOrLoad(
    getChatMetaKey(dbRoot, chatKey),
    async () => {
      const [lastMessageResponse, unreadResponse] = await Promise.all([
        axios.get(`${dbRoot}/Chats/${chatKey}/lastMessage.json`).catch(() => ({ data: null })),
        axios.get(`${dbRoot}/Chats/${chatKey}/unread.json`).catch(() => ({ data: {} })),
      ]);

      return {
        lastMessage: lastMessageResponse.data || null,
        unreadNode: unreadResponse.data || {},
      };
    },
    { ttlMs: CHAT_LIST_TTL_MS, force }
  );
}

export async function loadUserProfile(dbRoot, userId, { force = false } = {}) {
  if (!dbRoot || !userId) return null;

  return getOrLoad(
    getUserKey(dbRoot, userId),
    async () => {
      const directResponse = await axios.get(`${dbRoot}/Users/${userId}.json`).catch(() => ({ data: null }));
      if (directResponse.data) {
        return directResponse.data;
      }

      const queryResponse = await axios
        .get(`${dbRoot}/Users.json`, {
          params: {
            orderBy: JSON.stringify("userId"),
            equalTo: JSON.stringify(String(userId)),
          },
        })
        .catch(() => ({ data: {} }));

      return Object.values(queryResponse.data || {})[0] || null;
    },
    { ttlMs: USER_TTL_MS, persist: true, force }
  );
}

export async function loadUsersByRole(dbRoot, role, { force = false } = {}) {
  if (!dbRoot || !role) return [];

  const normalizedRole = String(role).toLowerCase();

  return getOrLoad(
    getRoleKey(dbRoot, normalizedRole),
    async () => {
      const response = await axios
        .get(`${dbRoot}/Users.json`, {
          params: {
            orderBy: JSON.stringify("role"),
            equalTo: JSON.stringify(normalizedRole),
          },
        })
        .catch(() => ({ data: {} }));

      return Object.values(response.data || {}).map((user) => ({
        ...user,
        userId: user?.userId || "",
        role: user?.role || normalizedRole,
      }));
    },
    { ttlMs: USER_TTL_MS, persist: true, force }
  );
}

export async function loadSchoolPeople(dbRoot, role, { force = false } = {}) {
  if (!dbRoot || !role) return [];

  const normalizedRole = normalizeUserType(role);
  const isParent = normalizedRole === "parent";
  const recordsNode = isParent ? "Parents" : "Students";

  return getOrLoad(
    getSchoolPeopleKey(dbRoot, normalizedRole),
    async () => {
      const [usersResponse, recordsResponse, studentsResponse] = await Promise.all([
        axios.get(`${dbRoot}/Users.json`).catch(() => ({ data: {} })),
        axios.get(`${dbRoot}/${recordsNode}.json`).catch(() => ({ data: {} })),
        isParent
          ? axios.get(`${dbRoot}/Students.json`).catch(() => ({ data: {} }))
          : Promise.resolve({ data: {} }),
      ]);

      const usersNode = usersResponse.data || {};
      const recordsNodeData = recordsResponse.data || {};
      const studentsNode = studentsResponse.data || {};

      return Object.entries(recordsNodeData)
        .map(([recordId, recordNode]) => {
          if (isParent) {
            return toParentContact(recordId, recordNode || {}, usersNode, studentsNode);
          }

          return toStudentContact(recordId, recordNode || {}, usersNode);
        })
        .filter((person) => Boolean(person?.userId || person?.id))
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
    },
    { ttlMs: USER_TTL_MS, persist: true, force }
  );
}

export function sortGradeValues(values) {
  return sortGradeValuesInternal(values);
}

export async function loadManagedGrades(dbRoot, { force = false } = {}) {
  if (!dbRoot) return [];

  return getOrLoad(
    getManagedGradesKey(dbRoot),
    async () => {
      const response = await axios.get(`${dbRoot}/GradeManagement/grades.json`).catch(() => ({ data: {} }));
      const gradesNode = response.data || {};
      return sortGradeValuesInternal(Object.keys(gradesNode || {}));
    },
    { ttlMs: USER_TTL_MS, persist: true, force }
  );
}

export async function fetchConversationSummaries({ dbRoot, currentUserId, force = false }) {
  if (!dbRoot || !currentUserId) return [];

  const shallowChats = await getOrLoad(
    getChatListKey(dbRoot, currentUserId),
    async () => {
      const response = await axios
        .get(`${dbRoot}/Chats.json`, {
          params: { shallow: true },
        })
        .catch(() => ({ data: {} }));

      return response.data || {};
    },
    { ttlMs: CHAT_LIST_TTL_MS, force }
  );

  const chatKeys = Object.keys(shallowChats || {}).filter((chatKey) => {
    const parts = parseChatParts(chatKey);
    return parts.includes(String(currentUserId));
  });

  if (chatKeys.length === 0) {
    return [];
  }

  const metaRows = await Promise.all(
    chatKeys.map(async (chatKey) => {
      const meta = await loadChatMeta(dbRoot, chatKey, force);
      const peerUserId = inferPeerUserId(chatKey, currentUserId, meta?.lastMessage);

      return {
        chatKey,
        peerUserId,
        lastMessage: meta?.lastMessage || null,
        unreadCount: Number(meta?.unreadNode?.[currentUserId] || 0),
        lastTimestamp: Number(meta?.lastMessage?.timeStamp || 0),
      };
    })
  );

  const rowsByPeer = new Map();

  metaRows.forEach((row) => {
    if (!row.peerUserId) return;

    const previous = rowsByPeer.get(row.peerUserId);
    if (!previous) {
      rowsByPeer.set(row.peerUserId, row);
      return;
    }

    rowsByPeer.set(row.peerUserId, {
      ...previous,
      chatKey: row.lastTimestamp >= previous.lastTimestamp ? row.chatKey : previous.chatKey,
      lastMessage: row.lastTimestamp >= previous.lastTimestamp ? row.lastMessage : previous.lastMessage,
      lastTimestamp: Math.max(previous.lastTimestamp, row.lastTimestamp),
      unreadCount: Number(previous.unreadCount || 0) + Number(row.unreadCount || 0),
    });
  });

  const peerIds = Array.from(rowsByPeer.keys());
  const profiles = await Promise.all(peerIds.map((userId) => loadUserProfile(dbRoot, userId, { force })));
  const profileMap = new Map(peerIds.map((userId, index) => [userId, profiles[index] || null]));

  return peerIds
    .map((userId) => {
      const row = rowsByPeer.get(userId);
      const profile = profileMap.get(userId) || {};

      return {
        userId,
        chatKey: row.chatKey || buildChatKey(currentUserId, userId),
        unreadCount: Number(row.unreadCount || 0),
        lastMessage: row.lastMessage || null,
        lastTimestamp: Number(row.lastTimestamp || 0),
        name: profile?.name || profile?.username || "User",
        profileImage: profile?.profileImage || "/default-profile.png",
        type: normalizeUserType(profile?.role),
        role: profile?.role || "",
        lastSeen: profile?.lastSeen || null,
      };
    })
    .sort((left, right) => right.lastTimestamp - left.lastTimestamp);
}

export async function markConversationAsSeen({ dbRoot, currentUserId, chatKey }) {
  if (!dbRoot || !currentUserId || !chatKey) return;

  const messagesResponse = await axios
    .get(`${dbRoot}/Chats/${chatKey}/messages.json`)
    .catch(() => ({ data: {} }));

  const messages = messagesResponse.data || {};
  const updates = {};

  Object.entries(messages).forEach(([messageId, message]) => {
    if (String(message?.receiverId) === String(currentUserId) && !message?.seen) {
      updates[`Chats/${chatKey}/messages/${messageId}/seen`] = true;
    }
  });

  updates[`Chats/${chatKey}/unread/${currentUserId}`] = 0;

  const lastMessageResponse = await axios
    .get(`${dbRoot}/Chats/${chatKey}/lastMessage.json`)
    .catch(() => ({ data: null }));

  const lastMessage = lastMessageResponse.data;
  if (lastMessage && String(lastMessage.receiverId) === String(currentUserId) && lastMessage.seen === false) {
    updates[`Chats/${chatKey}/lastMessage/seen`] = true;
  }

  await axios.patch(`${dbRoot}/.json`, updates).catch(() => {});

  clearCachedValue(getChatMetaKey(dbRoot, chatKey));
  clearCachedValue(getChatListKey(dbRoot, currentUserId));
}