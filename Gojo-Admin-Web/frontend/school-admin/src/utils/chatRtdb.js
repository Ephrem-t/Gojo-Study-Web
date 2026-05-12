export const DEFAULT_PROFILE_IMAGE = "/default-profile.png";
const CHAT_SUMMARY_NODE = "Chat_Summaries";

export const uniqueNonEmptyValues = (values) => {
  const seen = new Set();
  const normalizedValues = [];

  (values || []).forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      return;
    }

    const lookupKey = normalizedValue.toLowerCase();
    if (seen.has(lookupKey)) {
      return;
    }

    seen.add(lookupKey);
    normalizedValues.push(normalizedValue);
  });

  return normalizedValues;
};

export const fetchJson = async (url, fallbackValue = null) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return fallbackValue;
    }

    return await response.json();
  } catch {
    return fallbackValue;
  }
};

export const buildChatKeyCandidates = (currentUserId, otherUserId) => {
  const leftId = String(currentUserId || "").trim();
  const rightId = String(otherUserId || "").trim();
  if (!leftId || !rightId) {
    return [];
  }

  return uniqueNonEmptyValues([
    [leftId, rightId].sort().join("_"),
    `${leftId}_${rightId}`,
    `${rightId}_${leftId}`,
  ]);
};

export const resolveExistingChatKey = (chatKeySet, currentUserId, otherUserId) => {
  const candidateKeys = buildChatKeyCandidates(currentUserId, otherUserId);
  if (!(chatKeySet instanceof Set)) {
    return candidateKeys[0] || "";
  }

  return candidateKeys.find((candidateKey) => chatKeySet.has(candidateKey)) || candidateKeys[0] || "";
};

export const parseChatParticipantIds = (chatKey, participantsNode = null) => {
  const fromParticipants = Object.keys(participantsNode || {}).filter(Boolean);
  const fromKey = String(chatKey || "").split("_").filter(Boolean);
  return uniqueNonEmptyValues([...fromParticipants, ...fromKey]);
};

export const inferContactTypeFromUser = (userRecord = {}) => {
  const normalizedRole = String(userRecord?.role || userRecord?.userType || "").trim().toLowerCase();
  const normalizedUsername = String(userRecord?.username || "").trim().toLowerCase();

  if (normalizedRole.includes("teacher") || normalizedUsername.startsWith("get_")) {
    return "teacher";
  }

  if (normalizedRole.includes("student") || normalizedUsername.startsWith("gmis_")) {
    return "student";
  }

  if (normalizedRole.includes("parent") || normalizedUsername.startsWith("gmip_")) {
    return "parent";
  }

  if (
    normalizedRole.includes("management") ||
    normalizedRole.includes("office") ||
    normalizedRole.includes("finance") ||
    normalizedRole.includes("hr") ||
    normalizedRole.includes("register") ||
    normalizedRole.includes("admin") ||
    normalizedUsername.startsWith("gmif_") ||
    normalizedUsername.startsWith("geh_") ||
    normalizedUsername.startsWith("gsr_") ||
    normalizedUsername.startsWith("gem_") ||
    normalizedUsername.startsWith("gmia_")
  ) {
    return "management";
  }

  return "teacher";
};

export const formatLastMessagePreview = (lastMessage) => {
  const messageText = String(lastMessage?.text || "").trim();
  if (messageText) {
    return messageText;
  }

  const normalizedType = String(lastMessage?.type || "").trim().toLowerCase();
  if (normalizedType === "image") {
    return "Image";
  }

  if (normalizedType === "video") {
    return "Video";
  }

  return "No text";
};

export const getSafeProfileImage = (value, fallback = DEFAULT_PROFILE_IMAGE) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return fallback;
  }

  const lowerValue = normalizedValue.toLowerCase();
  if (
    lowerValue === "null" ||
    lowerValue === "undefined" ||
    lowerValue.startsWith("file://") ||
    lowerValue.startsWith("content://")
  ) {
    return fallback;
  }

  return normalizedValue;
};

export const getConversationSortTime = (rawValue) => {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return 0;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsedTime = new Date(trimmedValue).getTime();
    if (!Number.isNaN(parsedTime)) {
      return parsedTime;
    }
  }

  return 0;
};

export const buildChatSummaryPath = (ownerUserId, chatId) => {
  return `${CHAT_SUMMARY_NODE}/${String(ownerUserId || "").trim()}/${String(chatId || "").trim()}`;
};

export const buildOwnerChatSummariesPath = (ownerUserId) => {
  return `${CHAT_SUMMARY_NODE}/${String(ownerUserId || "").trim()}`;
};

export const buildChatSummaryPreview = ({ text = "", type = "" } = {}) => {
  const normalizedType = String(type || "").trim().toLowerCase();

  if (normalizedType === "image") return "Image";
  if (normalizedType === "video") return "Video";
  if (normalizedType === "deleted") return "";

  return String(text || "").trim();
};

export const normalizeChatSummaryValue = (value = {}, fallback = {}) => {
  const lastMessageType = String(value?.lastMessageType || fallback?.lastMessageType || "text").trim().toLowerCase() || "text";
  const lastMessageTime = getConversationSortTime(value?.lastMessageTime ?? fallback?.lastMessageTime);
  const unreadCount = Math.max(0, Number(value?.unreadCount ?? fallback?.unreadCount ?? 0) || 0);

  return {
    chatId: String(value?.chatId || fallback?.chatId || "").trim(),
    otherUserId: String(value?.otherUserId || fallback?.otherUserId || "").trim(),
    unreadCount,
    lastMessageText: buildChatSummaryPreview({
      text: value?.lastMessageText ?? fallback?.lastMessageText,
      type: lastMessageType,
    }),
    lastMessageType,
    lastMessageTime,
    lastSenderId: String(value?.lastSenderId || fallback?.lastSenderId || "").trim(),
    lastMessageSeen: Boolean(value?.lastMessageSeen ?? fallback?.lastMessageSeen),
    lastMessageSeenAt: value?.lastMessageSeenAt ?? fallback?.lastMessageSeenAt ?? null,
    updatedAt: String(value?.updatedAt || fallback?.updatedAt || "").trim(),
  };
};

export const buildChatSummaryUpdate = (summary = {}) => {
  const patch = {
    updatedAt: new Date(getConversationSortTime(summary?.lastMessageTime) || Date.now()).toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(summary, "chatId")) {
    patch.chatId = String(summary?.chatId || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(summary, "otherUserId")) {
    patch.otherUserId = String(summary?.otherUserId || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(summary, "unreadCount")) {
    patch.unreadCount = Math.max(0, Number(summary?.unreadCount || 0) || 0);
  }

  const hasLastMessageData = ["lastMessageText", "lastMessageType", "lastMessageTime", "lastSenderId"].some((key) =>
    Object.prototype.hasOwnProperty.call(summary, key)
  );

  if (hasLastMessageData) {
    const lastMessageType = String(summary?.lastMessageType || "text").trim().toLowerCase() || "text";
    patch.lastMessageType = lastMessageType;
    patch.lastMessageText = buildChatSummaryPreview({
      text: summary?.lastMessageText,
      type: lastMessageType,
    });
    patch.lastMessageTime = getConversationSortTime(summary?.lastMessageTime);
    patch.lastSenderId = String(summary?.lastSenderId || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(summary, "lastMessageSeen")) {
    patch.lastMessageSeen = Boolean(summary?.lastMessageSeen);
  }

  if (Object.prototype.hasOwnProperty.call(summary, "lastMessageSeenAt")) {
    patch.lastMessageSeenAt = summary?.lastMessageSeenAt ?? null;
  }

  return patch;
};

export const mapInBatches = async (items, batchSize, mapper) => {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
  const results = [];

  for (let index = 0; index < sourceItems.length; index += normalizedBatchSize) {
    const batch = sourceItems.slice(index, index + normalizedBatchSize);
    const batchResults = await Promise.all(batch.map(mapper));
    results.push(...batchResults);
  }

  return results;
};