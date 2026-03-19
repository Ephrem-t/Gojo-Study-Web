const FALLBACK_PROFILE_IMAGE = "/default-profile.png";

const isValidProfileImage = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  if (trimmed.startsWith("file://")) return false;

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  );
};

export const resolveProfileImage = (...candidates) => {
  for (const candidate of candidates) {
    if (isValidProfileImage(candidate)) {
      return String(candidate).trim();
    }
  }
  return FALLBACK_PROFILE_IMAGE;
};

export const getFallbackProfileImage = () => FALLBACK_PROFILE_IMAGE;
