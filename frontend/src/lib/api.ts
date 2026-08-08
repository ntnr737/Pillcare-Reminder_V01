import type {
  Profile,
  Medication,
  Dose,
  Measurement,
  Activity,
  Mood,
  AdherenceData,
  DailyMessageResponse,
  CatalogResponse,
  GenericResolveResponse,
  ScanMedicationResponse,
  CreateMedicationRequest,
  UpdateMedicationRequest,
  CreateMeasurementRequest,
  CreateActivityRequest,
  CreateMoodRequest,
  UpsertProfileRequest,
  ApiError,
} from "@/src/types";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

class ApiClient {
  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    try {
      const res = await fetch(`${BASE}/api${path}`, {
        headers: { "Content-Type": "application/json" },
        ...opts,
      });

      if (!res.ok) {
        const text = await res.text();
        const error: ApiError = {
          message: text || `Request failed with status ${res.status}`,
          status: res.status,
        };
        throw error;
      }

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return res.json() as Promise<T>;
      }
      return res.text() as unknown as Promise<T>;
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }
      // Network error or other non-API error
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
      throw apiError;
    }
  }

  // Profile endpoints
  getProfile = (): Promise<Profile> => this.request<Profile>("/profile");

  upsertProfile = (data: UpsertProfileRequest): Promise<Profile> =>
    this.request<Profile>("/profile", {
      method: "POST",
      body: JSON.stringify(data),
    });

  // Medication endpoints
  listMedications = (active?: boolean): Promise<Medication[]> => {
    const query = active !== undefined ? `?active=${active}` : "";
    return this.request<Medication[]>(`/medications${query}`);
  };

  createMedication = (data: CreateMedicationRequest): Promise<Medication> =>
    this.request<Medication>("/medications", {
      method: "POST",
      body: JSON.stringify(data),
    });

  updateMedication = (id: string, data: UpdateMedicationRequest): Promise<Medication> => {
    if (!id || typeof id !== "string" || id.length === 0) {
      throw { message: "Invalid medication ID", status: 400 } as ApiError;
    }
    return this.request<Medication>(`/medications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  };

  deleteMedication = (id: string): Promise<{ success: boolean }> => {
    if (!id || typeof id !== "string" || id.length === 0) {
      throw { message: "Invalid medication ID", status: 400 } as ApiError;
    }
    return this.request<{ success: boolean }>(`/medications/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  };

  // Dose endpoints
  listDoses = (date: string): Promise<Dose[]> => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw { message: "Invalid date format. Expected YYYY-MM-DD", status: 400 } as ApiError;
    }
    return this.request<Dose[]>(`/doses?date_str=${encodeURIComponent(date)}`);
  };

  setDoseStatus = (id: string, status: string): Promise<Dose> => {
    if (!id || typeof id !== "string" || id.length === 0) {
      throw { message: "Invalid dose ID", status: 400 } as ApiError;
    }
    if (!["pending", "taken", "skipped", "missed"].includes(status)) {
      throw { message: "Invalid status", status: 400 } as ApiError;
    }
    return this.request<Dose>(`/doses/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  };

  // Measurement endpoints
  listMeasurements = (type?: string): Promise<Measurement[]> => {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.request<Measurement[]>(`/measurements${query}`);
  };

  createMeasurement = (data: CreateMeasurementRequest): Promise<Measurement> =>
    this.request<Measurement>("/measurements", {
      method: "POST",
      body: JSON.stringify(data),
    });

  deleteMeasurement = (id: string): Promise<{ success: boolean }> => {
    if (!id || typeof id !== "string" || id.length === 0) {
      throw { message: "Invalid measurement ID", status: 400 } as ApiError;
    }
    return this.request<{ success: boolean }>(`/measurements/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  };

  // Activity endpoints
  listActivities = (type?: string): Promise<Activity[]> => {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.request<Activity[]>(`/activities${query}`);
  };

  createActivity = (data: CreateActivityRequest): Promise<Activity> =>
    this.request<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(data),
    });

  // Mood endpoints
  listMood = (): Promise<Mood[]> => this.request<Mood[]>("/mood");

  createMood = (data: CreateMoodRequest): Promise<Mood> =>
    this.request<Mood>("/mood", {
      method: "POST",
      body: JSON.stringify(data),
    });

  // Progress endpoints
  adherence = (days: number = 7): Promise<AdherenceData[]> => {
    if (days < 1 || days > 365) {
      throw { message: "Days must be between 1 and 365", status: 400 } as ApiError;
    }
    return this.request<AdherenceData[]>(`/progress/adherence?days=${days}`);
  };

  // AI endpoints
  dailyMessage = (): Promise<DailyMessageResponse> =>
    this.request<DailyMessageResponse>("/ai/daily-message");

  // Catalog endpoints
  units = (): Promise<CatalogResponse> => this.request<CatalogResponse>("/catalog/units");

  measurementCatalog = (): Promise<CatalogResponse> =>
    this.request<CatalogResponse>("/catalog/measurements");

  activityCatalog = (): Promise<CatalogResponse> =>
    this.request<CatalogResponse>("/catalog/activities");

  // Utility endpoints
  resolveGeneric = (brand: string): Promise<GenericResolveResponse> => {
    if (!brand || brand.trim().length === 0) {
      throw { message: "Brand name is required", status: 400 } as ApiError;
    }
    return this.request<GenericResolveResponse>("/resolve-generic", {
      method: "POST",
      body: JSON.stringify({ brand: brand.trim() }),
    });
  };

  scanMedication = (image_base64: string): Promise<ScanMedicationResponse> => {
    if (!image_base64 || image_base64.length === 0) {
      throw { message: "Image data is required", status: 400 } as ApiError;
    }
    return this.request<ScanMedicationResponse>("/scan-medication", {
      method: "POST",
      body: JSON.stringify({ image_base64 }),
    });
  };

  caregiverAlert = (message: string, medication_name?: string): Promise<{ success: boolean }> => {
    if (!message || message.trim().length === 0) {
      throw { message: "Message is required", status: 400 } as ApiError;
    }
    return this.request<{ success: boolean }>("/caregiver/alert", {
      method: "POST",
      body: JSON.stringify({ message: message.trim(), medication_name }),
    });
  };

  exportCsvUrl = (): string => `${BASE}/api/export/csv`;
}

export const api = new ApiClient();
