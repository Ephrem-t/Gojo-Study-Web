// Central backend base URL. Try Vite env, Node env, legacy React env, then default.
const DEFAULT_BACKEND = "https://gojo-teacher-web.onrender.com";

const viteEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_BASE;
const nodeViteEnv = typeof process !== 'undefined' && process.env && process.env.VITE_BACKEND_BASE;
const reactEnv = typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_BASE;

// Normalize: pick first non-empty, trim whitespace and remove trailing slash
const rawBase = (viteEnv || nodeViteEnv || reactEnv || DEFAULT_BACKEND) || DEFAULT_BACKEND;
export const BACKEND_BASE = String(rawBase).trim().replace(/\/$/, "");

// Example override for local development (Vite): create .env with
// VITE_BACKEND_BASE=http://127.0.0.1:5000
