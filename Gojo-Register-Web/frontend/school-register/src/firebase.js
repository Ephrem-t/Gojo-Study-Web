
// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <-- ADD THIS
import { RTDB_BASE_RAW, schoolPath } from "./api/rtdbScope";

const firebaseConfig = {
  apiKey: "AIzaSyCXMU6x1UQpsLM9q11j6am6lj6zx9DtqB8",
  authDomain: "gojo-education.firebaseapp.com",
  databaseURL: RTDB_BASE_RAW,
  projectId: "gojo-education",
  storageBucket: "gojo-education.firebasestorage.app",
  messagingSenderId: "579247228743",
  appId: "1:579247228743:web:fd2dcccf939c347a6f2e62",
  measurementId: "G-Q45XN2W3FS"
};

// Only initialize if no apps exist
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Realtime Database
export const db = getDatabase(app);

// Firestore
export const firestore = getFirestore(app);

export const storage = getStorage(app);
export { RTDB_BASE_RAW, schoolPath };
export default app;

