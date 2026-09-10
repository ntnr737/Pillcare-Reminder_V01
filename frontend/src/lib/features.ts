import AsyncStorage from "@react-native-async-storage/async-storage";

export type Features = {
  plan: "free" | "premium" | "enterprise";
  plan_expires: string | null;
  max_medications: number;
  history_days: number;
  ai_insights: string;
  caregiver_alerts: number;
  nearby_results: number;
  yoga_full: boolean;
  export_data: boolean;
  brand_generic: boolean;
  scanner: boolean;
  max_appointments: number;
};

export const FREE_DEFAULTS: Features = {
  plan: "premium",
  plan_expires: "2099-12-31T23:59:59Z",
  max_medications: 999,
  history_days: 365,
  ai_insights: "daily",
  caregiver_alerts: 999,
  nearby_results: 50,
  yoga_full: true,
  export_data: true,
  brand_generic: true,
  scanner: true,
  max_appointments: 999,
};

const FEATURES_KEY = "pillcare_features_v1";
let _cache: Features = { ...FREE_DEFAULTS };
let _listeners: Array<(f: Features) => void> = [];

export function getFeatures(): Features { return _cache; }

export function onFeaturesChange(fn: (f: Features) => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function notify() { _listeners.forEach(fn => fn(_cache)); }

export async function loadCachedFeatures(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(FEATURES_KEY);
    if (raw) { _cache = { ...FREE_DEFAULTS, ...JSON.parse(raw) }; notify(); }
  } catch {}
}

export async function fetchFeatures(token: string): Promise<void> {
  try {
    const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    const res = await fetch(`${BASE}/api/me/features`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: Features = await res.json();
    _cache = { ...FREE_DEFAULTS, ...data };
    await AsyncStorage.setItem(FEATURES_KEY, JSON.stringify(_cache));
    notify();
  } catch {}
}

export function isPremium(): boolean {
  return _cache.plan === "premium" || _cache.plan === "enterprise";
}
