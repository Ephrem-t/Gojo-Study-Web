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