export const DEFAULT_API_BASE = "http://localhost:8000";

// The path main.py serves this file at when CLIENT_HTML_PATH is set.
export const SERVED_BY_API_PATH = "/client";

export const API_BASE_STORAGE_KEY = "resume-api-client.api-base";
export const SESSION_STORAGE_KEY = "resume-api-client.session";

export const DOC_TYPES = ["resume", "metadata", "skill"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const SESSION_LOW_WARNING_MS = 5 * 60 * 1000;
