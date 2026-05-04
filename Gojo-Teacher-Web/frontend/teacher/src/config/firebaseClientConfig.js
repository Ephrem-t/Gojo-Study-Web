const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCXMU6x1UQpsLM9q11j6am6lj6zx9DtqB8",
  authDomain: "gojo-education.firebaseapp.com",
  databaseURL: "https://gojo-education-default-rtdb.firebaseio.com",
  projectId: "gojo-education",
  storageBucket: "gojo-education.firebasestorage.app",
  messagingSenderId: "579247228743",
  appId: "1:579247228743:web:fd2dcccf939c347a6f2e62",
  measurementId: "G-Q45XN2W3FS",
};

const trimEnvValue = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export const firebaseConfig = {
  apiKey: trimEnvValue(import.meta.env.VITE_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: trimEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, DEFAULT_FIREBASE_CONFIG.authDomain),
  databaseURL: trimEnvValue(import.meta.env.VITE_FIREBASE_DATABASE_URL, DEFAULT_FIREBASE_CONFIG.databaseURL),
  projectId: trimEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: trimEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: trimEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId: trimEnvValue(import.meta.env.VITE_FIREBASE_APP_ID, DEFAULT_FIREBASE_CONFIG.appId),
  measurementId: trimEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, DEFAULT_FIREBASE_CONFIG.measurementId),
};

export const RTDB_BASE_RAW = firebaseConfig.databaseURL.replace(/\/+$/, "");
