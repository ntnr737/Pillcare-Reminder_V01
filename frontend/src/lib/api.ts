const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as Promise<T>;
}

export const api = {
  getProfile: () => req<any>("/profile"),
  upsertProfile: (data: any) => req<any>("/profile", { method: "POST", body: JSON.stringify(data) }),
  listMedications: (active?: boolean) => req<any[]>(`/medications${active !== undefined ? `?active=${active}` : ""}`),
  createMedication: (data: any) => req<any>("/medications", { method: "POST", body: JSON.stringify(data) }),
  updateMedication: (id: string, data: any) => req<any>(`/medications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMedication: (id: string) => req<any>(`/medications/${id}`, { method: "DELETE" }),
  listDoses: (date: string) => req<any[]>(`/doses?date_str=${date}`),
  setDoseStatus: (id: string, status: string) => req<any>(`/doses/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  listMeasurements: (type?: string) => req<any[]>(`/measurements${type ? `?type=${type}` : ""}`),
  createMeasurement: (data: any) => req<any>("/measurements", { method: "POST", body: JSON.stringify(data) }),
  deleteMeasurement: (id: string) => req<any>(`/measurements/${id}`, { method: "DELETE" }),
  listActivities: (type?: string) => req<any[]>(`/activities${type ? `?type=${type}` : ""}`),
  createActivity: (data: any) => req<any>("/activities", { method: "POST", body: JSON.stringify(data) }),
  listMood: () => req<any[]>("/mood"),
  createMood: (data: any) => req<any>("/mood", { method: "POST", body: JSON.stringify(data) }),
  adherence: (days: number = 7) => req<any>(`/progress/adherence?days=${days}`),
  units: () => req<{ units: string[] }>("/catalog/units"),
  measurementCatalog: () => req<{ measurements: any[] }>("/catalog/measurements"),
  activityCatalog: () => req<{ activities: any[] }>("/catalog/activities"),
  resolveGeneric: (brand: string) => req<{ brand: string; generic: string }>("/resolve-generic", { method: "POST", body: JSON.stringify({ brand }) }),
  scanMedication: (image_base64: string) => req<any>("/scan-medication", { method: "POST", body: JSON.stringify({ image_base64 }) }),
  caregiverAlert: (message: string, medication_name?: string) => req<any>("/caregiver/alert", { method: "POST", body: JSON.stringify({ message, medication_name }) }),
  exportCsvUrl: () => `${BASE}/api/export/csv`,
};
