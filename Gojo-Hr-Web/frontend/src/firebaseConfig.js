// Firebase web config from environment variables
// These values are safe to expose in client-side code
// Firebase security is managed through Firebase Security Rules, not API key secrecy
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Validate Firebase configuration
if (import.meta.env.DEV) {
  const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket']
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key])
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing Firebase configuration:', missingKeys)
    console.error('Please check your .env.development file')
  } else {
    console.log('✅ Firebase configuration loaded successfully')
  }
}
