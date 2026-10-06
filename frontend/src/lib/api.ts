import { getStoredToken } from "./auth";
import type { Features } from "./features";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

async function req<T>(path: string, opts: RequestInit = {}, timeoutMs = 7000): Promise<T> {
  const token = await getStoredToken();
  let deviceTimezone = "Asia/Kolkata";
  try {
    deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {}
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "X-Device-Timezone": deviceTimezone,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      ...opts,
    });
    if (res.status === 401) {
      // Import signOut dynamically to prevent circular imports
      const { signOut } = require("./auth");
      signOut().catch(() => {});
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json() as Promise<T>;
    return res.text() as unknown as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}
function localDateStr(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export const api = {
  getProfile: () => req<any>("/profile"),
  upsertProfile: (data: any) => req<any>("/profile", { method: "POST", body: JSON.stringify(data) }),
  listMedications: (active?: boolean) => req<any[]>(`/medications${active !== undefined ? `?active=${active}` : ""}`),
  createMedication: (data: any) => req<any>("/medications", { method: "POST", body: JSON.stringify(data) }),
  updateMedication: (id: string, data: any) => req<any>(`/medications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMedication: (id: string) => req<any>(`/medications/${id}`, { method: "DELETE" }),
  listDoses: (date: string) => req<any[]>(`/doses?date_str=${date}`),
  setDoseStatus: (id: string, status: string, taken_at?: string) => req<any>(`/doses/${id}/status`, { method: "POST", body: JSON.stringify({ status, taken_at }) }),
  markTakenByMedication: (medication_id: string, scheduled_time?: string, taken_at?: string) =>
    req<any>("/doses/mark-taken-by-medication", { method: "POST", body: JSON.stringify({ medication_id, scheduled_time, taken_at }) }),
  listMeasurements: (type?: string) => req<any[]>(`/measurements${type ? `?type=${type}` : ""}`),
  createMeasurement: (data: any) => req<any>("/measurements", { method: "POST", body: JSON.stringify(data) }),
  deleteMeasurement: (id: string) => req<any>(`/measurements/${id}`, { method: "DELETE" }),
  listActivities: (type?: string) => req<any[]>(`/activities${type ? `?type=${type}` : ""}`),
  createActivity: (data: any) => req<any>("/activities", { method: "POST", body: JSON.stringify(data) }),
  listMood: () => req<any[]>("/mood"),
  createMood: (data: any) => req<any>("/mood", { method: "POST", body: JSON.stringify(data) }),
  adherence: (days: number = 7) => req<any>(`/progress/adherence?days=${days}&local_date=${localDateStr()}`),
  yogaTip: () => req<any>("/yoga-tip"),
  getDrugFoodGuide: () => req<any>("/treatment/drug-food-guide"),
  doseHistory: (days: number = 30) => req<any[]>(`/doses/history?days=${days}`),
  listAppointments: () => req<any[]>("/appointments"),
  createAppointment: (data: any) => req<any>("/appointments", { method: "POST", body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => req<any>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => req<any>(`/appointments/${id}`, { method: "DELETE" }),
  dailyMessage: () => req<{ message: string; streak: number; yoga_tip?: string }>(`/ai/daily-message?local_date=${localDateStr()}`),
  units: () => req<{ units: string[] }>("/catalog/units"),
  measurementCatalog: () => req<{ measurements: any[] }>("/catalog/measurements"),
  activityCatalog: () => req<{ activities: any[] }>("/catalog/activities"),
  resolveGeneric: (brand: string) => req<{ brand: string; generic: string }>("/resolve-generic", { method: "POST", body: JSON.stringify({ brand }) }, 15000),
  scanMedication: (image_base64: string) => req<any>("/scan-medication", { method: "POST", body: JSON.stringify({ image_base64 }) }, 15000),
  caregiverAlert: (message: string, medication_name?: string) => req<any>("/caregiver/alert", { method: "POST", body: JSON.stringify({ message, medication_name }) }),
  caregiverLog: () => req<any[]>("/caregiver/log"),
  exportCsvUrl: async () => {
    const token = await getStoredToken();
    return `${BASE}/api/export/csv${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },
  exportExcelUrl: async () => {
    const token = await getStoredToken();
    return `${BASE}/api/export/excel${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },
  exportCsv: async (): Promise<string> => {
    const token = await getStoredToken();
    const res = await fetch(`${BASE}/api/export/csv`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Export failed (${res.status}): ${text}`);
    }
    return res.text();
  },
  yogaComplete: (step_num: number, step_name: string, video_url?: string) =>
    req<any>("/yoga/complete", { method: "POST", body: JSON.stringify({ step_num, step_name, video_url, local_date: localDateStr() }) }),
  yogaUncomplete: (step_num: number, step_name: string) =>
    req<any>("/yoga/uncomplete", { method: "POST", body: JSON.stringify({ step_num, step_name, local_date: localDateStr() }) }),
  yogaLog: (days: number = 30) => req<any[]>(`/yoga/log?days=${days}`),
  applyReminderNudge: (medId: string, current_time: string, suggested_time: string) =>
    req<any>(`/medications/${medId}/apply-nudge`, { method: "POST", body: JSON.stringify({ current_time, suggested_time }) }),
  refillMedication: (medId: string, addStock: number = 30) =>
    req<any>(`/medications/${medId}/refill`, { method: "POST", body: JSON.stringify({ add_stock: addStock }) }),
  completeMedication: (medId: string) =>
    req<any>(`/medications/${medId}/complete`, { method: "POST" }),
  moodAdherenceInsight: (days: number = 14) => req<any>(`/insights/mood-adherence?days=${days}`),
  getFeatures: () => req<Features>("/me/features"),
  updateCaregiver: (phone: string) => req<any>("/profile/caregiver", { method: "POST", body: JSON.stringify({ caregiver_phone: phone }) }),
  updateCaregivers: (caregivers: string[]) => req<any>("/profile/caregivers", { method: "POST", body: JSON.stringify({ caregivers }) }),
  savePushToken: (push_token: string) => req<any>("/profile/push-token", { method: "POST", body: JSON.stringify({ push_token }) }),
  trackEvent: (event: string, props: Record<string, any> = {}) => req<any>("/analytics/track", { method: "POST", body: JSON.stringify({ event, props }) }),
  postTelemetryEvent: (event: string, props: Record<string, any> = {}) => req<any>("/analytics/track", { method: "POST", body: JSON.stringify({ event, props }) }),
  heartbeatPing: (network_type: string = "WiFi/5G", app_version: string = "v1.0.16") => req<any>("/users/heartbeat", { method: "POST", body: JSON.stringify({ network_type, app_version }) }).catch(() => null),
  getSubscription: () => req<any>("/me/subscription"),
  upgradePlan: (plan: string = "premium", days: number = 30) => req<any>("/me/upgrade", { method: "POST", body: JSON.stringify({ plan, days }) }),
  createPaymentOrder: (plan: string = "premium", amount_inr: number = 99) => req<any>("/payments/create-order", { method: "POST", body: JSON.stringify({ plan, amount_inr }) }),
  verifyPayment: (order_id: string, payment_id: string, plan: string = "premium") => req<any>("/payments/verify", { method: "POST", body: JSON.stringify({ order_id, payment_id, plan }) }),
  exportExcel: () => req<any>("/export/excel"),
  getActiveAnnouncements: (plan?: string) => req<any[]>(`/announcements/active?plan=${plan || "free"}`),
  getLeaderboard: () => req<any>("/leaderboard"),
};
