// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { schoolPath } from "./api/rtdbScope";

// ---------------- Replace these values with your Firebase project credentials ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCXMU6x1UQpsLM9q11j6am6lj6zx9DtqB8",
  authDomain: "gojo-education.firebaseapp.com",
  databaseURL: "https://gojo-education-default-rtdb.firebaseio.com",
  projectId: "gojo-education",
  storageBucket: "gojo-education.firebasestorage.app",
  messagingSenderId: "579247228743",
  appId: "1:579247228743:web:79a822ad859841106f2e62",
  measurementId: "G-1F69BFH4WS"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();


export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export { schoolPath };
export default app;




