
// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <-- ADD THIS
import { RTDB_BASE_RAW, schoolPath } from "./api/rtdbScope";

const firebaseConfig = {
  apiKey: "AIzaSyD47Nw8JROSGpk_HrzOwpoAek_PH12pBS8",
  authDomain: "bale-house-rental.firebaseapp.com",
  databaseURL: RTDB_BASE_RAW,
  projectId: "bale-house-rental",
  storageBucket: "bale-house-rental.appspot.com",
  messagingSenderId: "964518277159",
  appId: "1:964518277159:web:73f590faf40217cc961e02",
  measurementId: "G-X7LYG9HX43"
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

