const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE) || "/api";
