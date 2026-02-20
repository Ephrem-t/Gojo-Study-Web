import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)
let analytics = null
try { analytics = getAnalytics(app) } catch (e) { /* browser only */ }

export { app, analytics }
