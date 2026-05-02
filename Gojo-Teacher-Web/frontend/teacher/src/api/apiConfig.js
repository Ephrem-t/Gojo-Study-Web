const TEACHER_API_PORT = "5001";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const getDefaultApiBase = () => {
	if (typeof window === "undefined") {
		return `http://127.0.0.1:${TEACHER_API_PORT}/api`;
	}

	const { protocol, hostname, port } = window.location;
	if (port && port !== TEACHER_API_PORT) {
		return "/api";
	}

	const resolvedProtocol = protocol === "https:" ? "https:" : "http:";
	const resolvedHost = hostname || "127.0.0.1";
	return `${resolvedProtocol}//${resolvedHost}:${TEACHER_API_PORT}/api`;
};

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE) || getDefaultApiBase();
