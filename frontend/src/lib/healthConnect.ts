import { Platform } from "react-native";

export type HealthSnapshot = {
  steps: number | null;
  heartRate: number | null;
  sleepHours: number | null;
  granted: boolean;
  available: boolean;
  error?: string;
};

const RECORD_TYPES = ["Steps", "HeartRate", "SleepSession"] as const;

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
    return RECORD_TYPES.every((recordType) =>
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
    return { steps: null, heartRate: null, sleepHours: null, granted: false, available: false };
  }

  try {
    await hc.initialize();
    const granted = await hasHealthPermissions();
    if (!granted) {
      return { steps: null, heartRate: null, sleepHours: null, granted: false, available: true };
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sleepWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [stepsRes, hrRes, sleepRes] = await Promise.all([
      hc.readRecords("Steps", {
        timeRangeFilter: { operator: "between", startTime: startOfDay.toISOString(), endTime: now.toISOString() },
      }),
      hc.readRecords("HeartRate", {
        timeRangeFilter: { operator: "between", startTime: startOfDay.toISOString(), endTime: now.toISOString() },
      }),
      hc.readRecords("SleepSession", {
        timeRangeFilter: { operator: "between", startTime: sleepWindowStart.toISOString(), endTime: now.toISOString() },
      }),
    ]);

    const steps = (stepsRes.records || []).reduce((sum: number, r: any) => sum + (r.count || 0), 0);

    const allSamples = (hrRes.records || []).flatMap((r: any) => r.samples || []);
    const heartRate = allSamples.length
      ? Math.round(allSamples[allSamples.length - 1].beatsPerMinute)
      : null;

    const sleepMs = (sleepRes.records || []).reduce((sum: number, r: any) => {
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.endTime).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    const sleepHours = sleepMs > 0 ? Math.round((sleepMs / 3600000) * 10) / 10 : null;

    return { steps, heartRate, sleepHours, granted: true, available: true };
  } catch (e: any) {
    return {
      steps: null,
      heartRate: null,
      sleepHours: null,
      granted: false,
      available: true,
      error: String(e?.message || e),
    };
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
      await Linking.openURL("package:com.google.android.apps.healthdata");
    } catch {
      try {
        await Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata");
      } catch {}
    }
  }
}
