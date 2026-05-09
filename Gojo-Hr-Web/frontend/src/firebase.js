import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)

const shouldEnableAnalytics =
	typeof window !== 'undefined'
	&& !['localhost', '127.0.0.1'].includes(window.location.hostname)

let analytics = null
if (shouldEnableAnalytics) {
	try {
		analytics = getAnalytics(app)
	} catch (e) {
		analytics = null
	}
}

export { app, analytics }
