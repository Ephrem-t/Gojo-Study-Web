import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { schoolPath } from "./api/rtdbScope";

const trimEnv = (value, fallback = "") => {
  const v = String(value ?? "").trim();
  return v || fallback;
};

// Default values used when VITE_ env vars are not set (e.g. local dev without .env)
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyCXMU6x1UQpsLM9q11j6am6lj6zx9DtqB8",
  authDomain: "gojo-education.firebaseapp.com",
  databaseURL: "https://gojo-education-default-rtdb.firebaseio.com",
  projectId: "gojo-education",
  storageBucket: "gojo-education.firebasestorage.app",
  messagingSenderId: "579247228743",
  appId: "1:579247228743:web:79a822ad859841106f2e62",
  measurementId: "G-1F69BFH4WS",
};

const firebaseConfig = {
  apiKey:            trimEnv(import.meta.env.VITE_FIREBASE_API_KEY,            DEFAULT_CONFIG.apiKey),
  authDomain:        trimEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,        DEFAULT_CONFIG.authDomain),
  databaseURL:       trimEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL,       DEFAULT_CONFIG.databaseURL),
  projectId:         trimEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID,         DEFAULT_CONFIG.projectId),
  storageBucket:     trimEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,     DEFAULT_CONFIG.storageBucket),
  messagingSenderId: trimEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,DEFAULT_CONFIG.messagingSenderId),
  appId:             trimEnv(import.meta.env.VITE_FIREBASE_APP_ID,             DEFAULT_CONFIG.appId),
  measurementId:     trimEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,     DEFAULT_CONFIG.measurementId),
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export { schoolPath };
export default app;