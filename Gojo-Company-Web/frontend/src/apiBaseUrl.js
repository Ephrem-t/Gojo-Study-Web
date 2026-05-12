const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:5000'
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://gojo-company-web.onrender.com'

function normalizeBaseUrl(value) {
	return String(value || '').trim().replace(/\/$/, '')
}

export const API_BASE_URL = (() => {
	const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
	if (configuredBaseUrl) {
		return configuredBaseUrl
	}

	if (import.meta.env.PROD) {
		return DEFAULT_PRODUCTION_API_BASE_URL
	}

	return DEFAULT_LOCAL_API_BASE_URL
})()