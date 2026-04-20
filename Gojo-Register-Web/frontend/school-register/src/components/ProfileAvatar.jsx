import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_FALLBACK_COLOR = "var(--accent-strong, #007afb)";
const DEFAULT_SURFACE_COLOR = "var(--surface-panel, #ffffff)";
const DEFAULT_BORDER_COLOR = "var(--border-soft, rgba(15, 23, 42, 0.12))";
const DEFAULT_TEXT_COLOR = "var(--text-primary, #0f172a)";
const LOADED_IMAGE_CACHE = new Set();

const hasUsableProfileImage = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  return lowered !== "null" && lowered !== "undefined" && normalized !== "/default-profile.png";
};

const getAvatarInitials = (value) => {
  const parts = String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "U";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
};

export default function ProfileAvatar({
  imageUrl,
  name,
  alt,
  size = 40,
  borderRadius = "50%",
  className,
  style,
  imgStyle,
  textStyle,
}) {
  const normalizedImageUrl = String(imageUrl || "").trim();
  const [hideImage, setHideImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(
    hasUsableProfileImage(normalizedImageUrl) && LOADED_IMAGE_CACHE.has(normalizedImageUrl)
  );

  useEffect(() => {
    if (!hasUsableProfileImage(normalizedImageUrl)) {
      setHideImage(false);
      setImageLoaded(false);
      return;
    }

    setHideImage(false);
    setImageLoaded(LOADED_IMAGE_CACHE.has(normalizedImageUrl));
  }, [normalizedImageUrl]);

  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  const resolvedBorderRadius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  const initials = useMemo(() => getAvatarInitials(name || alt), [name, alt]);
  const shouldAttemptImage = hasUsableProfileImage(normalizedImageUrl) && !hideImage;
  const shouldShowLoadedImage = shouldAttemptImage && imageLoaded;
  const fallbackFontSize = typeof size === "number" ? Math.max(12, Math.round(size * 0.34)) : 14;

  return (
    <div
      className={className}
      style={{
        width: resolvedSize,
        height: resolvedSize,
        minWidth: resolvedSize,
        minHeight: resolvedSize,
        borderRadius: resolvedBorderRadius,
        overflow: "hidden",
        flexShrink: 0,
        border: shouldShowLoadedImage ? `1px solid ${DEFAULT_BORDER_COLOR}` : `1px solid ${DEFAULT_FALLBACK_COLOR}`,
        background: shouldShowLoadedImage ? DEFAULT_SURFACE_COLOR : DEFAULT_FALLBACK_COLOR,
        color: shouldShowLoadedImage ? DEFAULT_TEXT_COLOR : "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fallbackFontSize,
        fontWeight: 900,
        letterSpacing: "0.03em",
        lineHeight: 1,
        position: "relative",
        textTransform: "uppercase",
        userSelect: "none",
        ...style,
      }}
      aria-label={alt || name || "Profile avatar"}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
          ...textStyle,
        }}
      >
        {initials}
      </span>

      {shouldAttemptImage ? (
        <img
          src={normalizedImageUrl}
          alt={alt || name || "Profile avatar"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "relative",
            zIndex: 2,
            opacity: shouldShowLoadedImage ? 1 : 0,
            transition: "opacity 0.16s ease",
            ...imgStyle,
          }}
          onLoad={() => {
            LOADED_IMAGE_CACHE.add(normalizedImageUrl);
            setImageLoaded(true);
          }}
          onError={() => {
            LOADED_IMAGE_CACHE.delete(normalizedImageUrl);
            setHideImage(true);
            setImageLoaded(false);
          }}
        />
      ) : null}
    </div>
  );
}