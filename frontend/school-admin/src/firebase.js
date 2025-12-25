// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// ---------------- Replace these values with your Firebase project credentials ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCMkZr4Xz204NjvETje-Rhznf6ECDYiEnE",                      // e.g., "AIzaSyA..."
  authDomain: "ethiostore-17d9f.firebaseapp.com",   // your project auth domain
  databaseURL: "https://ethiostore-17d9f-default-rtdb.firebaseio.com", // Realtime DB URL
  projectId: "ethiostore-17d9f",               // your project ID
  storageBucket: "ethiostore-17d9f.appspot.com",
  messagingSenderId: "964518277159",
  appId: "1:964518277159:web:9404cace890edf88961e02"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const db = getDatabase(app);

// Export the database reference
export { db };
