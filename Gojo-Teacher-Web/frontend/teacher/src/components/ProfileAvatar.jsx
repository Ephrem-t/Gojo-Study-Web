import React, { useEffect, useMemo, useState } from "react";
import {
  createProfilePlaceholder,
  isFallbackProfileImage,
  resolveProfileImage,
} from "../utils/profileImage";

const loadedAvatarSrcCache = new Set();

const isInstantImageSource = (value) =>
  typeof value === "string" &&
  (value.startsWith("data:") || value.startsWith("blob:"));

const canDisplayImmediately = (value) =>
  typeof value === "string" &&
  (loadedAvatarSrcCache.has(value) || isInstantImageSource(value));

export default function ProfileAvatar({
  src,
  name = "User",
  alt,
  ...imgProps
}) {
  const placeholderSrc = useMemo(
    () => createProfilePlaceholder(name),
    [name]
  );

  const resolvedSrc = useMemo(() => {
    const normalizedSrc = resolveProfileImage(src);
    if (isFallbackProfileImage(normalizedSrc)) {
      return placeholderSrc;
    }
    return normalizedSrc;
  }, [placeholderSrc, src]);

  const [displaySrc, setDisplaySrc] = useState(() =>
    canDisplayImmediately(resolvedSrc) ? resolvedSrc : placeholderSrc
  );

  useEffect(() => {
    if (resolvedSrc === placeholderSrc) {
      setDisplaySrc(placeholderSrc);
      return undefined;
    }

    if (canDisplayImmediately(resolvedSrc)) {
      setDisplaySrc(resolvedSrc);
      return undefined;
    }

    let cancelled = false;
    const preloadImage = new Image();

    preloadImage.onload = () => {
      loadedAvatarSrcCache.add(resolvedSrc);
      if (!cancelled) {
        setDisplaySrc(resolvedSrc);
      }
    };

    preloadImage.onerror = () => {
      if (!cancelled) {
        setDisplaySrc(placeholderSrc);
      }
    };

    preloadImage.src = resolvedSrc;

    return () => {
      cancelled = true;
    };
  }, [placeholderSrc, resolvedSrc]);

  return (
    <img
      {...imgProps}
      src={displaySrc}
      alt={alt || name || "profile"}
      onError={(event) => {
        const fallbackSrc = createProfilePlaceholder(name);
        if (event.currentTarget.src !== fallbackSrc) {
          event.currentTarget.src = fallbackSrc;
        }
      }}
    />
  );
}