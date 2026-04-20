const FALLBACK_PROFILE_IMAGE = "/default-profile.png";

const escapeSvgText = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

export const isFallbackProfileImage = (value) =>
  String(value || "").trim() === FALLBACK_PROFILE_IMAGE;

export const getProfileInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "U";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
};

export const createProfilePlaceholder = (name) => {
  const initials = escapeSvgText(getProfileInitials(name));
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <defs>
    <linearGradient id='avatarGradient' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#007AFB'/>
      <stop offset='100%' stop-color='#00B6A9'/>
    </linearGradient>
  </defs>
  <rect width='160' height='160' rx='80' fill='url(#avatarGradient)'/>
  <text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Segoe UI, Arial, sans-serif' font-size='56' font-weight='700'>${initials}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const resolveAvatarImage = (name, ...candidates) => {
  const resolvedImage = resolveProfileImage(...candidates);
  if (isFallbackProfileImage(resolvedImage)) {
    return createProfilePlaceholder(name);
  }
  return resolvedImage;
};

export const getFallbackProfileImage = () => FALLBACK_PROFILE_IMAGE;
