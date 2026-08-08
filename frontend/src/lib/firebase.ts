// Firebase JS SDK init. Analytics only runs on web (isSupported check).
// Configured but not actively used for auth in this build — single local profile is used.
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import Constants from "expo-constants";

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const firebaseApp = app;

// Analytics is web-only. Lazy import to avoid bundler crashes on native.
export async function initAnalytics() {
  try {
    if (typeof window === "undefined") return null;
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    const supported = await isSupported();
    if (!supported) return null;
    return getAnalytics(app);
  } catch {
    return null;
  }
}

export async function logEvent(name: string, params?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    const { getAnalytics, isSupported, logEvent: fbLogEvent } = await import("firebase/analytics");
    const supported = await isSupported();
    if (!supported) return;
    const analytics = getAnalytics(app);
    fbLogEvent(analytics, name as never, params as never);
  } catch {
    /* noop */
  }
}
