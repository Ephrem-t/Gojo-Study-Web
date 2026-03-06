// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { schoolPath } from "./api/rtdbScope";

// ---------------- Replace these values with your Firebase project credentials ----------------
const firebaseConfig = {
  apiKey: "AIzaSyD47Nw8JROSGpk_HrzOwpoAek_PH12pBS8",
  authDomain: "bale-house-rental.firebaseapp.com",
  databaseURL: "https://bale-house-rental-default-rtdb.firebaseio.com",
  projectId: "bale-house-rental",
  storageBucket: "bale-house-rental.appspot.com",
  messagingSenderId: "964518277159",
  appId: "1:964518277159:web:73f590faf40217cc961e02",
  measurementId: "G-X7LYG9HX43"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();


export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export { schoolPath };
export default app;




