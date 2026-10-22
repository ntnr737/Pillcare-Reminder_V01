import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getStoredToken } from "./auth";
import { API_BASE_URL } from "./config";

export type Features = {
  plan: "free" | "basic" | "premium" | "caregiver_shield" | "family" | "family_annual" | "lifetime" | "enterprise";
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
  is_guest?: boolean;
  google_login?: boolean;
  apple_login?: boolean;
  maintenance_mode?: boolean;
};

export const FREE_DEFAULTS: Features = {
  plan: "free",
  plan_expires: null,
  max_medications: 3,
  history_days: 7,
  ai_insights: "weekly",
  caregiver_alerts: 0,
  nearby_results: 5,
  yoga_full: false,
  export_data: false,
  brand_generic: false,
  scanner: false,
  max_appointments: 2,
  is_guest: true,
  google_login: true,
  apple_login: true,
  maintenance_mode: false,
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


export async function fetchFeatures(token?: string): Promise<void> {
  try {
    const BASE = API_BASE_URL;
    if (!BASE || !BASE.startsWith("http")) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-App-Platform": Platform.OS,
      "X-App-Version": Constants.expoConfig?.version || "0.0.0",
    };
    const locale = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().locale : "";
    const countryMatch = locale.match(/[-_]([A-Za-z]{2})$/);
    if (countryMatch?.[1]) headers["X-App-Country"] = countryMatch[1].toUpperCase();
    const effectiveToken = token || (await getStoredToken());
    if (effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;
    const res = await fetch(`${BASE}/api/me/features`, { headers });
    if (!res.ok) return;
    const data: Features = await res.json();
    _cache = { ...FREE_DEFAULTS, ...data };
    await AsyncStorage.setItem(FEATURES_KEY, JSON.stringify(_cache));
    notify();
  } catch {}
}

export function isPremium(): boolean {
  const p = (_cache.plan || "").toLowerCase();
  return p !== "" && p !== "free" && p !== "guest";
}
