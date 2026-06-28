// Firebase JS SDK init. Analytics only runs on web (isSupported check).
// Configured but not actively used for auth in this build — single local profile is used.
import { initializeApp, getApps, FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAe7caDRnHwMLCLzXvZEv6HGmqDY_n8HcU",
  authDomain: "pillcare-5fcac.firebaseapp.com",
  projectId: "pillcare-5fcac",
  storageBucket: "pillcare-5fcac.firebasestorage.app",
  messagingSenderId: "1082668880575",
  appId: "1:1082668880575:web:779d808ac09945f80bec0a",
  measurementId: "G-X8WF8SD4DF",
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
