/**
 * sync.ts — offline-first sync engine
 *
 * CORE GUARANTEE: A dose marked "taken" is PERMANENT on the device.
 * Server data NEVER overwrites a locally-taken dose — even if the server
 * still shows it as "pending" (because the sync hasn't happened yet).
 *
 * Flow:
 * 1. User marks dose → saved to AsyncStorage immediately + added to write queue
 * 2. App tries to push to server right away (online) or queues it (offline)
 * 3. When reconnecting → flush queue FIRST, THEN fetch server data
 * 4. On every server fetch → merge: local "taken" always wins over server "pending"
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, localDateStr } from "./api";
import { get, set, K } from "./store";

const QUEUE_KEY = "pc6_write_queue";
const TAKEN_KEY_PREFIX = "pc6_taken_doses_"; // persistent taken dose IDs per date
const STATUS_KEY_PREFIX = "pc6_dose_status_"; // persistent dose statuses per date

const LAST_SYNC_KEY = "pc6_last_sync_timestamp";
let syncing = false;
let lastSyncTimestamp = 0;

export async function getLastSyncTimestampAsync(): Promise<number> {
  if (lastSyncTimestamp > 0) return lastSyncTimestamp;
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (raw) {
      lastSyncTimestamp = parseInt(raw, 10) || 0;
      return lastSyncTimestamp;
    }
  } catch {}
  return 0;
}

export function getLastSyncTimestamp(): number {
  return lastSyncTimestamp;
}

export function setLastSyncTimestamp(ts: number = Date.now()): void {
  lastSyncTimestamp = ts;
  AsyncStorage.setItem(LAST_SYNC_KEY, String(ts)).catch(() => {});
}

// ─── Persistent dose status registry ─────────────────────────────────────────

export type LocalDoseRecord = {
  status: "taken" | "skipped";
  timestamp: string;
};

/**
 * Record that a dose was taken or skipped on a given date.
 * Indexed by canonical dose ID and (medication_id, scheduled_time) to guarantee 100% match rate.
 */
export async function recordDoseStatus(
  doseId: string,
  date: string,
  status: "taken" | "skipped",
  timestamp: string,
  medicationId?: string,
  scheduledTime?: string
): Promise<void> {
  try {
    const key = STATUS_KEY_PREFIX + date;
    const raw = await AsyncStorage.getItem(key);
    const existing: Record<string, LocalDoseRecord> = raw ? JSON.parse(raw) : {};
    const rec: LocalDoseRecord = { status, timestamp };

    existing[doseId] = rec;
    if (medicationId && scheduledTime) {
      const cleanTime = scheduledTime.replace(/[^a-zA-Z0-9]/g, "");
      existing[`${medicationId}_${scheduledTime}`] = rec;
      existing[`med_${medicationId}_${date}_${scheduledTime}`] = rec;
      existing[`dose_${medicationId}_${date}_${cleanTime}`] = rec;
      existing[`local_dose_${medicationId}_${date}_${cleanTime}`] = rec;
    }
    await AsyncStorage.setItem(key, JSON.stringify(existing));

    // Maintain legacy TAKEN_KEY_PREFIX compatibility
    if (status === "taken") {
      const takenKey = TAKEN_KEY_PREFIX + date;
      const rawTaken = await AsyncStorage.getItem(takenKey);
      const existingTaken: Record<string, string> = rawTaken ? JSON.parse(rawTaken) : {};
      existingTaken[doseId] = timestamp;
      if (medicationId && scheduledTime) {
        existingTaken[`${medicationId}_${scheduledTime}`] = timestamp;
      }
      await AsyncStorage.setItem(takenKey, JSON.stringify(existingTaken));
    }
  } catch (err) {
    console.warn("Failed to record local dose status:", err);
  }
}

/**
 * Backward-compatible helper for recording taken doses.
 */
export async function recordTaken(
  doseId: string,
  date: string,
  takenAt: string,
  medicationId?: string,
  scheduledTime?: string
): Promise<void> {
  return recordDoseStatus(doseId, date, "taken", takenAt, medicationId, scheduledTime);
}

/**
 * Record that a dose was skipped.
 */
export async function recordSkipped(
  doseId: string,
  date: string,
  skippedAt: string,
  medicationId?: string,
  scheduledTime?: string
): Promise<void> {
  return recordDoseStatus(doseId, date, "skipped", skippedAt, medicationId, scheduledTime);
}

/**
 * Get all locally recorded dose statuses for a given date.
 */
export async function getLocalDoseStatuses(date: string): Promise<Record<string, LocalDoseRecord>> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY_PREFIX + date);
    let statusMap: Record<string, LocalDoseRecord> = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          statusMap = parsed;
        }
      } catch {}
    }

    // Merge with legacy taken keys if present
    const rawTaken = await AsyncStorage.getItem(TAKEN_KEY_PREFIX + date);
    if (rawTaken) {
      try {
        const takenMap = JSON.parse(rawTaken);
        if (takenMap && typeof takenMap === "object" && !Array.isArray(takenMap)) {
          for (const [k, v] of Object.entries(takenMap)) {
            if (!statusMap[k] && typeof v === "string") {
              statusMap[k] = { status: "taken", timestamp: v };
            }
          }
        }
      } catch {}
    }
    return statusMap;
  } catch {
    return {};
  }
}

/**
 * Merge server doses with local taken/skipped registry.
 * Local actions ALWAYS win — server "pending" is overridden if we have a local record.
 */
export async function mergeDoses(serverDoses: any[], date: string): Promise<any[]> {
  if (!Array.isArray(serverDoses)) return [];
  const localStatuses = await getLocalDoseStatuses(date);
  if (Object.keys(localStatuses).length === 0) return serverDoses;

  return serverDoses.map((dose) => {
    const medId = dose.medication_id || dose.medication?.id;
    const sched = dose.scheduled_time;
    const cleanTime = sched ? sched.replace(/[^a-zA-Z0-9]/g, "") : "";

    const local =
      localStatuses[dose.id] ||
      (medId && sched ? localStatuses[`${medId}_${sched}`] : null) ||
      (medId && sched ? localStatuses[`dose_${medId}_${date}_${cleanTime}`] : null) ||
      (medId && sched ? localStatuses[`local_dose_${medId}_${date}_${cleanTime}`] : null) ||
      (medId && sched ? localStatuses[`med_${medId}_${date}_${sched}`] : null);

    if (local && dose.status !== local.status) {
      return {
        ...dose,
        status: local.status,
        taken_at: local.status === "taken" ? local.timestamp : dose.taken_at,
        skipped_at: local.status === "skipped" ? local.timestamp : dose.skipped_at,
      };
    }
    return dose;
  });
}


// ─── Write queue ─────────────────────────────────────────────────────────────

import { getStoredUser } from "./auth";

type WriteItem = {
  id: string;
  ts: number;
  type: string;
  payload: any;
  owner_id?: string;
};

async function getQueue(): Promise<WriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    let items: any = null;
    try {
      items = JSON.parse(raw);
    } catch {
      await AsyncStorage.removeItem(QUEUE_KEY);
      return [];
    }
    if (!Array.isArray(items)) {
      await AsyncStorage.removeItem(QUEUE_KEY);
      return [];
    }
    // 48-hour expiration filter
    const now = Date.now();
    const filtered = items.filter(i => i && typeof i === "object" && typeof i.ts === "number" && (now - i.ts) < 48 * 60 * 60 * 1000);
    if (filtered.length !== items.length) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch { return []; }
}

let writeQueueLock: Promise<any> = Promise.resolve();

async function removeFromQueue(id: string): Promise<void> {
  return new Promise((resolve) => {
    writeQueueLock = writeQueueLock.then(async () => {
      try {
        const q = await getQueue();
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(i => i.id !== id)));
      } catch {}
      resolve();
    });
  });
}

export async function enqueueWrite(type: string, payload: any, ownerId?: string): Promise<string> {
  return new Promise((resolve) => {
    writeQueueLock = writeQueueLock.then(async () => {
      try {
        const currentUser = await getStoredUser();
        const activeOwner = ownerId || currentUser?.id || "guest";
        const itemKey = payload?.id ? `${type}_${payload.id}` : null;
        const id = itemKey || `${Date.now()}_${Math.random()}`;
        let q = await getQueue();
        if (itemKey) {
          q = q.filter(i => i.id !== itemKey);
        }
        q.push({ id, ts: Date.now(), type, payload, owner_id: activeOwner });
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        resolve(id);
      } catch {
        resolve(`${Date.now()}`);
      }
    });
  });
}

/**
 * Flush all pending writes for the active authenticated user to the server.
 * Drop 4xx permanent failures to prevent queue blocking.
 */
export async function flushQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const currentUser = await getStoredUser();
    const activeOwner = currentUser?.id || "guest";
    const queue = await getQueue();
    const userQueue = queue.filter(item => !item.owner_id || item.owner_id === activeOwner);

    for (const item of userQueue) {
      try {
        switch (item.type) {
          case "doseStatus": {
            const p = item.payload || {};
            if (p.status === "taken" && p.medication_id) {
              await api.markTakenByMedication(p.medication_id, p.scheduled_time, p.taken_at);
            } else if (p.id) {
              try {
                await api.setDoseStatus(p.id, p.status || "taken", p.taken_at);
              } catch (err: any) {
                if (p.medication_id && (p.status === "taken" || !p.status)) {
                  await api.markTakenByMedication(p.medication_id, p.scheduled_time, p.taken_at);
                } else {
                  throw err;
                }
              }
            } else if (p.medication_id) {
              await api.markTakenByMedication(p.medication_id, p.scheduled_time, p.taken_at);
            }
            break;
          }
          case "measurement":
            await api.createMeasurement(item.payload);
            break;
          case "activity":
            await api.createActivity(item.payload);
            break;
          case "mood":
            await api.createMood(item.payload);
            break;
          case "profile":
            await api.upsertProfile(item.payload);
            break;
          case "medication":
            await api.createMedication(item.payload);
            break;
          case "medication_update":
            await api.updateMedication(item.payload.id, item.payload.data);
            break;
          case "medication_delete":
            await api.deleteMedication(item.payload.id);
            break;
          case "appointment":
            await api.createAppointment(item.payload);
            break;
          case "appointment_update":
            await api.updateAppointment(item.payload.id, item.payload.data);
            break;
          case "appointment_delete":
            await api.deleteAppointment(item.payload.id);
            break;
        }
        await removeFromQueue(item.id);
      } catch (err: any) {
        const errMsg = err?.message || "";
        const statusMatch = errMsg.match(/\b(4\d\d)\b/);
        const statusCode = err?.status || (statusMatch ? parseInt(statusMatch[1], 10) : 0);
        // Drop permanent 4xx failures (400, 401, 402, 403, 404, 422) to avoid blocking later queue entries.
        // 429 (Rate Limit) pauses queue flush to allow cooldown.
        if (
          (statusCode >= 400 && statusCode < 500 && statusCode !== 429) ||
          errMsg.includes("400") ||
          errMsg.includes("401") ||
          errMsg.includes("402") ||
          errMsg.includes("403") ||
          errMsg.includes("404") ||
          errMsg.includes("422")
        ) {
          console.warn(`Dropping unprocessable queued write (${item.id}):`, errMsg);
          await removeFromQueue(item.id);
        } else {
          // Network offline / 5xx error / 429 rate limit — pause queue flush until next connectivity cycle
          break;
        }
      }
    }

    // Refresh streak in background if any queue items were flushed
    if (userQueue.length > 0) {
      api.adherence(30).then((data: any) => {
        if (data && typeof data.streak === "number") {
          set(K.streak, data.streak).catch(() => {});
        }
      }).catch(() => {});
    }
  } finally {
    syncing = false;
  }
}

/**
 * Complete sign-out cleanup: Purge all local user caches, queue, and registries.
 */
export async function clearAllCachesOnSignOut(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(k =>
      k.startsWith("pc6_") ||
      k.startsWith("pillcare_") ||
      k.startsWith("@pillcare_")
    );
    await AsyncStorage.multiRemove(keysToRemove);
  } catch (e) {
    console.warn("Failed to clear local caches on sign-out:", e);
  }
}

export function backgroundRefresh(fn: () => Promise<void>): void {
  setTimeout(() => fn().catch(() => {}), 50);
}

/**
 * Bootstrap the user's complete data state on login or initial launch.
 * Pulls profile, medications, today's doses, hydration activities, yoga logs, and streak
 * in a single atomic payload via /api/me/sync-state, writing to local storage so
 * the UI renders instantly with zero blank latency.
 */
export async function bootstrapUserDataset(targetDate?: string): Promise<{
  profile: any;
  medications: any[];
  doses: any[];
  waterLogged: number;
  waterLogs: any[];
  yogaSteps: number[];
  streak: number;
} | null> {
  const d = targetDate || localDateStr();
  try {
    const data = await api.syncState(d);
    if (!data || !data.ok) return null;

    setLastSyncTimestamp();

    if (data.profile) {
      await set(K.profile, data.profile);
    }
    if (Array.isArray(data.medications)) {
      const localMeds = (await get<any[]>(K.medications)) || [];
      const pendingLocal = localMeds.filter((lm: any) => lm && lm.id && String(lm.id).startsWith("local_"));
      const serverIds = new Set(data.medications.map((sm: any) => String(sm.id)));
      const mergedMeds = [...data.medications, ...pendingLocal.filter((pl: any) => !serverIds.has(String(pl.id)))];
      await set(K.medications, mergedMeds);
    }
    let mergedDoses = data.doses || [];
    if (Array.isArray(data.doses)) {
      mergedDoses = await mergeDoses(data.doses, d);
      await set(K.doses(d), mergedDoses);
    }
    if (typeof data.water_logged_ml === "number") {
      await set(`water_${d}`, data.water_logged_ml);
      await set(`water_logged_${d}`, data.water_logged_ml);
    }
    if (Array.isArray(data.water_logs)) {
      await set(`water_logs_${d}`, data.water_logs);
    }
    if (Array.isArray(data.yoga_completed_steps)) {
      await set(`yoga_done_${d}`, data.yoga_completed_steps);
      await set(`yoga_done_diabetes_${d}`, data.yoga_completed_steps);
      await set(`yoga_done_bp_${d}`, data.yoga_completed_steps);
      await set(`yoga_done_energy_${d}`, data.yoga_completed_steps);
    }
    if (typeof data.streak_days === "number") {
      await set(K.streak, data.streak_days);
    }

    return {
      profile: data.profile,
      medications: data.medications || [],
      doses: mergedDoses,
      waterLogged: data.water_logged_ml || 0,
      waterLogs: data.water_logs || [],
      yogaSteps: data.yoga_completed_steps || [],
      streak: data.streak_days || 0,
    };
  } catch (err) {
    console.warn("api.syncState failed, falling back to parallel entity fetch:", err);
    try {
      const [prof, meds, doses, waterActivities, adh] = await Promise.all([
        api.getProfile().catch(() => null),
        api.listMedications(true).catch(() => []),
        api.listDoses(d).catch(() => []),
        api.listActivities("water").catch(() => []),
        api.adherence(30).catch(() => null),
      ]);

      setLastSyncTimestamp();

      if (prof) await set(K.profile, prof);
      if (Array.isArray(meds) && meds.length) await set(K.medications, meds);
      let mergedFallbackDoses = doses || [];
      if (Array.isArray(doses)) {
        mergedFallbackDoses = await mergeDoses(doses, d);
        await set(K.doses(d), mergedFallbackDoses);
      }
      let waterMl = 0;
      if (Array.isArray(waterActivities)) {
        waterMl = waterActivities
          .filter((a: any) => a.date === d || (a.recorded_at && a.recorded_at.startsWith(d)))
          .reduce((sum: number, a: any) => sum + (Number(a.value) || 0), 0);
      }
      await set(`water_${d}`, waterMl);
      await set(`water_logged_${d}`, waterMl);
      if (adh && typeof adh.streak === "number") await set(K.streak, adh.streak);

      return {
        profile: prof,
        medications: meds || [],
        doses: mergedFallbackDoses || [],
        waterLogged: waterMl,
        waterLogs: [],
        yogaSteps: [],
        streak: adh?.streak || 0,
      };
    } catch (fallbackErr) {
      console.warn("Bootstrap fallback also failed:", fallbackErr);
      setLastSyncTimestamp(); // Still set timestamp to avoid thrashing
      return null;
    }
  }
}

