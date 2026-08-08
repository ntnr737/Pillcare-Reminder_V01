// Core data models with proper TypeScript types

export type DoseStatus = "pending" | "taken" | "skipped" | "missed";

export interface Profile {
  id: string;
  nickname: string;
  gender: string;
  year_of_birth: number;
  routine_wake: string;
  routine_breakfast: string;
  routine_lunch: string;
  routine_dinner: string;
  routine_sleep: string;
}

export interface Medication {
  id: string;
  name: string;
  generic_name?: string;
  dosage: number;
  unit: string;
  frequency_per_day: number;
  times: string[];
  start_date: string;
  end_date?: string;
  stock: number;
  refill_threshold: number;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dose {
  id: string;
  medication_id: string;
  medication?: Medication;
  date_str: string;
  scheduled_time: string;
  status: DoseStatus;
  taken_at?: string;
  notes?: string;
}

export interface Measurement {
  id: string;
  type: string;
  value: number;
  systolic?: number;
  diastolic?: number;
  unit: string;
  recorded_at: string;
  notes?: string;
}

export interface Activity {
  id: string;
  type: string;
  value: number;
  unit: string;
  recorded_at: string;
  notes?: string;
}

export interface Mood {
  id: string;
  rating: number;
  notes?: string;
  recorded_at: string;
}

export interface AdherenceData {
  date: string;
  total: number;
  taken: number;
  percentage: number;
}

export interface DailyMessageResponse {
  message: string;
  streak: number;
}

export interface CatalogResponse {
  units?: string[];
  measurements?: Array<{
    key: string;
    label: string;
    unit: string;
    composite?: string[];
  }>;
  activities?: Array<{
    key: string;
    label: string;
    unit: string;
  }>;
}

export interface GenericResolveResponse {
  brand: string;
  generic: string;
}

export interface ScanMedicationResponse {
  name: string;
  dosage?: string;
  confidence?: number;
}

export interface ApiError {
  message: string;
  status: number;
}

// Request types
export interface CreateMedicationRequest {
  name: string;
  dosage: number;
  unit: string;
  frequency_per_day: number;
  times: string[];
  start_date: string;
  end_date?: string;
  stock: number;
  refill_threshold: number;
  notes?: string;
}

export interface UpdateMedicationRequest {
  name?: string;
  dosage?: number;
  unit?: string;
  frequency_per_day?: number;
  times?: string[];
  end_date?: string;
  stock?: number;
  refill_threshold?: number;
  notes?: string;
  active?: boolean;
}

export interface CreateMeasurementRequest {
  type: string;
  value: number;
  systolic?: number;
  diastolic?: number;
  notes?: string;
}

export interface CreateActivityRequest {
  type: string;
  value: number;
  notes?: string;
}

export interface CreateMoodRequest {
  rating: number;
  notes?: string;
}

export interface UpsertProfileRequest {
  nickname: string;
  gender: string;
  year_of_birth: number;
  routine_wake?: string;
  routine_breakfast?: string;
  routine_lunch?: string;
  routine_dinner?: string;
  routine_sleep?: string;
}
