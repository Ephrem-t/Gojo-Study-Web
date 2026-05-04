// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);