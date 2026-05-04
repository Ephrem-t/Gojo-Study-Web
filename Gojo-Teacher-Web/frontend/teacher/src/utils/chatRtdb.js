export const DEFAULT_PROFILE_IMAGE = "/default-profile.png";

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

  return candidateKeys.find((candidateKey) => chatKeySet.has(candidateKey)) || "";
};

export const parseChatParticipantIds = (chatKey, participantsNode = null) => {
  const fromParticipants = Object.keys(participantsNode || {}).filter(Boolean);
  const fromKey = String(chatKey || "").split("_").filter(Boolean);
  return uniqueNonEmptyValues([...fromParticipants, ...fromKey]);
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

export const chatKeyIncludesUser = (chatKey, userId) => {
  const normalizedChatKey = String(chatKey || "").trim();
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedChatKey || !normalizedUserId) {
    return false;
  }

  const escapedUserId = normalizedUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|_)${escapedUserId}(_|$)`, "i").test(normalizedChatKey);
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