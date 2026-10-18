export const DEFAULT_BACKEND_URL = "https://pillcare-backend-1082668880575.europe-west1.run.app";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL && process.env.EXPO_PUBLIC_BACKEND_URL.trim().length > 5
    ? process.env.EXPO_PUBLIC_BACKEND_URL.trim()
    : DEFAULT_BACKEND_URL;
