import { Platform } from "react-native";
import { api } from "./api";
import { get, set } from "./store";

const HC_KEY = "hc_connected_v1";
const HC_LAST_SYNC_KEY = "hc_last_auto_sync_ts";

export async function getHealthConnectConnected(): Promise<boolean> {
  const val = await get<boolean>(HC_KEY);
  return val === true;
}

export async function setHealthConnectConnected(connected: boolean): Promise<void> {
  await set(HC_KEY, connected);
}

export type HealthSnapshot = {
  steps: number | null;
  heartRate: number | null;
  sleepHours: number | null;
  systolic: number | null;
  diastolic: number | null;
  bloodGlucose: number | null;
  spo2: number | null;
  bodyTemp: number | null;
  weight: number | null;
  hydrationMl: number | null;
  caloriesBurned: number | null;
  lastSyncedAt: string | null;
  granted: boolean;
  available: boolean;
  error?: string;
};

export const RECORD_TYPES = [
  "Steps",
  "HeartRate",
  "SleepSession",
  "BloodPressure",
  "BloodGlucose",
  "OxygenSaturation",
  "BodyTemperature",
  "Weight",
  "Hydration",
  "ActiveCaloriesBurned",
] as const;

// react-native-health-connect is a native module (Android only) that isn't present
// in Expo Go — it only works in a custom dev client / EAS build. Guard every access
// so the app doesn't crash on iOS, web, or before that native build is installed.
function getModule(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    return require("react-native-health-connect");
  } catch {
    return null;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function hasHealthPermissions(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const granted = await hc.getGrantedPermissions();
    return RECORD_TYPES.some((recordType) =>
      granted.some((p: any) => p.recordType === recordType && p.accessType === "read")
    );
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    await hc.initialize();
    const granted = await hc.requestPermission(
      RECORD_TYPES.map((recordType) => ({ accessType: "read", recordType }))
    );
    return Array.isArray(granted) && granted.length > 0;
  } catch {
    return false;
  }
}

export async function readTodayVitals(): Promise<HealthSnapshot> {
  const hc = getModule();
  if (!hc) {
    return {
      steps: null, heartRate: null, sleepHours: null, systolic: null, diastolic: null,
      bloodGlucose: null, spo2: null, bodyTemp: null, weight: null, hydrationMl: null,
      caloriesBurned: null, lastSyncedAt: null, granted: false, available: false,
    };
  }

  try {
    await hc.initialize();
    const granted = await hasHealthPermissions();
    if (!granted) {
      return {
        steps: null, heartRate: null, sleepHours: null, systolic: null, diastolic: null,
        bloodGlucose: null, spo2: null, bodyTemp: null, weight: null, hydrationMl: null,
        caloriesBurned: null, lastSyncedAt: null, granted: false, available: true,
      };
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sleepWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeFilter = { operator: "between", startTime: startOfDay.toISOString(), endTime: now.toISOString() };

    const safeRead = async (recordType: string, filter: any = timeFilter) => {
      try {
        const res = await hc.readRecords(recordType, { timeRangeFilter: filter });
        return res?.records || [];
      } catch {
        return [];
      }
    };

    const [
      stepsRecs, hrRecs, sleepRecs, bpRecs, bgRecs, spo2Recs, tempRecs, weightRecs, hydRecs, calRecs
    ] = await Promise.all([
      safeRead("Steps"),
      safeRead("HeartRate"),
      safeRead("SleepSession", { operator: "between", startTime: sleepWindowStart.toISOString(), endTime: now.toISOString() }),
      safeRead("BloodPressure"),
      safeRead("BloodGlucose"),
      safeRead("OxygenSaturation"),
      safeRead("BodyTemperature"),
      safeRead("Weight"),
      safeRead("Hydration"),
      safeRead("ActiveCaloriesBurned"),
    ]);

    const steps = stepsRecs.reduce((sum: number, r: any) => sum + (r.count || 0), 0) || null;

    const hrSamples = hrRecs.flatMap((r: any) => r.samples || []);
    const heartRate = hrSamples.length ? Math.round(hrSamples[hrSamples.length - 1].beatsPerMinute) : null;

    const sleepMs = sleepRecs.reduce((sum: number, r: any) => {
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.endTime).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    const sleepHours = sleepMs > 0 ? Math.round((sleepMs / 3600000) * 10) / 10 : null;

    const latestBp = bpRecs.length ? bpRecs[bpRecs.length - 1] : null;
    const systolic = latestBp?.systolic?.inMillimetersOfMercury ? Math.round(latestBp.systolic.inMillimetersOfMercury) : null;
    const diastolic = latestBp?.diastolic?.inMillimetersOfMercury ? Math.round(latestBp.diastolic.inMillimetersOfMercury) : null;

    const latestBg = bgRecs.length ? bgRecs[bgRecs.length - 1] : null;
    const bloodGlucose = latestBg?.level?.inMilligramsPerDeciliter ? Math.round(latestBg.level.inMilligramsPerDeciliter) : null;

    const latestSpo2 = spo2Recs.length ? spo2Recs[spo2Recs.length - 1] : null;
    const spo2 = latestSpo2?.percentage?.value != null ? Math.round(latestSpo2.percentage.value * (latestSpo2.percentage.value <= 1 ? 100 : 1)) : null;

    const latestTemp = tempRecs.length ? tempRecs[tempRecs.length - 1] : null;
    const bodyTemp = latestTemp?.temperature?.inCelsius ? Math.round(latestTemp.temperature.inCelsius * 10) / 10 : null;

    const latestWeight = weightRecs.length ? weightRecs[weightRecs.length - 1] : null;
    const weight = latestWeight?.weight?.inKilograms ? Math.round(latestWeight.weight.inKilograms * 10) / 10 : null;

    const hydrationMl = hydRecs.reduce((sum: number, r: any) => sum + Math.round((r.volume?.inMilliliters || 0)), 0) || null;

    const caloriesBurned = calRecs.reduce((sum: number, r: any) => sum + Math.round(r.energy?.inKilocalories || 0), 0) || null;

    return {
      steps, heartRate, sleepHours, systolic, diastolic, bloodGlucose,
      spo2, bodyTemp, weight, hydrationMl, caloriesBurned,
      lastSyncedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      granted: true, available: true,
    };
  } catch (e: any) {
    return {
      steps: null, heartRate: null, sleepHours: null, systolic: null, diastolic: null,
      bloodGlucose: null, spo2: null, bodyTemp: null, weight: null, hydrationMl: null,
      caloriesBurned: null, lastSyncedAt: null, granted: false, available: true,
      error: String(e?.message || e),
    };
  }
}

export async function syncHealthVitalsToPillCare(snapshot: HealthSnapshot): Promise<{ syncedCount: number }> {
  let count = 0;
  try {
    if (snapshot.steps) {
      await api.createActivity({ type: "steps", value: snapshot.steps, unit: "steps", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.heartRate) {
      await api.createMeasurement({ type: "heart_rate", value: snapshot.heartRate, unit: "bpm", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.sleepHours) {
      await api.createActivity({ type: "sleep", value: snapshot.sleepHours, unit: "hrs", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.systolic && snapshot.diastolic) {
      await api.createMeasurement({ type: "blood_pressure", value: snapshot.systolic, value_secondary: snapshot.diastolic, unit: "mmHg", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.bloodGlucose) {
      await api.createMeasurement({ type: "blood_glucose", value: snapshot.bloodGlucose, unit: "mg/dL", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.spo2) {
      await api.createMeasurement({ type: "spo2", value: snapshot.spo2, unit: "%", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.bodyTemp) {
      await api.createMeasurement({ type: "body_temp", value: snapshot.bodyTemp, unit: "°C", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
    if (snapshot.weight) {
      await api.createMeasurement({ type: "weight", value: snapshot.weight, unit: "kg", note: "Synced from Health Connect" }).catch(() => {});
      count++;
    }
  } catch {}
  return { syncedCount: count };
}

export async function autoSyncVitalsIfNeeded(snapshot: HealthSnapshot): Promise<number> {
  if (!snapshot || !snapshot.granted) return 0;
  try {
    const lastSync = (await get<number>(HC_LAST_SYNC_KEY)) || 0;
    const now = Date.now();
    // Throttle silent auto-sync to at most once every 15 minutes
    if (now - lastSync < 15 * 60 * 1000) {
      return 0;
    }
    const res = await syncHealthVitalsToPillCare(snapshot);
    await set(HC_LAST_SYNC_KEY, now);
    return res.syncedCount;
  } catch {
    return 0;
  }
}

export async function openHealthConnectSettings() {
  const hc = getModule();
  if (hc && hc.openHealthConnectSettings) {
    try {
      await hc.openHealthConnectSettings();
      return;
    } catch {}
  }
  const { Linking } = require("react-native");
  try {
    await Linking.openURL("healthconnect://androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS?package=com.pillcare.reminder");
  } catch {
    try {
      await Linking.openURL("package:com.google.android.apps.google.android.apps.healthdata");
    } catch {
      try {
        await Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata");
      } catch {}
    }
  }
}
