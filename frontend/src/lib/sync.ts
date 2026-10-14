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
import { api } from "./api";
import { set, K } from "./store";

const QUEUE_KEY = "pc6_write_queue";
const TAKEN_KEY_PREFIX = "pc6_taken_doses_"; // persistent taken dose IDs per date

let syncing = false;

// ─── Persistent taken dose registry ─────────────────────────────────────────

/**
 * Record that a dose was taken on a given date.
 * This set persists in AsyncStorage and is NEVER cleared by server data.
 */
export async function recordTaken(doseId: string, date: string, takenAt: string): Promise<void> {
  try {
    const key = TAKEN_KEY_PREFIX + date;
    const raw = await AsyncStorage.getItem(key);
    const existing: Record<string, string> = raw ? JSON.parse(raw) : {};
    existing[doseId] = takenAt;
    await AsyncStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

/**
 * Get all locally-taken dose IDs for a date, with their taken_at timestamps.
 */
export async function getLocalTaken(date: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(TAKEN_KEY_PREFIX + date);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Merge server doses with local taken registry.
 * Local "taken" ALWAYS wins — server "pending" is ignored if we have a local record.
 */
export async function mergeDoses(serverDoses: any[], date: string): Promise<any[]> {
  const localTaken = await getLocalTaken(date);
  if (Object.keys(localTaken).length === 0) return serverDoses;

  return serverDoses.map(dose => {
    const localTakenAt = localTaken[dose.id];
    if (localTakenAt && dose.status !== "taken") {
      // Server hasn't caught up yet — keep local taken status
      return { ...dose, status: "taken", taken_at: localTakenAt };
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
    const items: WriteItem[] = JSON.parse(raw);
    // 48-hour expiration filter
    const now = Date.now();
    const filtered = items.filter(i => (now - i.ts) < 48 * 60 * 60 * 1000);
    if (filtered.length !== items.length) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch { return []; }
}

async function removeFromQueue(id: string): Promise<void> {
  try {
    const q = await getQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(i => i.id !== id)));
  } catch {}
}

export async function enqueueWrite(type: string, payload: any, ownerId?: string): Promise<string> {
  const currentUser = await getStoredUser();
  const activeOwner = ownerId || currentUser?.id || "guest";
  const itemKey = payload?.id ? `${type}_${payload.id}` : null;
  const id = itemKey || `${Date.now()}_${Math.random()}`;
  try {
    let q = await getQueue();
    if (itemKey) {
      q = q.filter(i => i.id !== itemKey);
    }
    q.push({ id, ts: Date.now(), type, payload, owner_id: activeOwner });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
  return id;
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
            if (p.id && !String(p.id).startsWith("med_")) {
              await api.setDoseStatus(p.id, p.status || "taken", p.taken_at);
            } else if (p.medication_id) {
              await api.markTakenByMedication(p.medication_id, p.scheduled_time, p.taken_at);
            } else if (p.id) {
              await api.setDoseStatus(p.id, p.status || "taken", p.taken_at);
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
        // Drop permanent 4xx failures to avoid blocking later queue entries
        if (errMsg.includes("400") || errMsg.includes("404") || errMsg.includes("422")) {
          console.warn(`Dropping unprocessable queued write (${item.id}):`, errMsg);
          await removeFromQueue(item.id);
        } else {
          // Network offline / 5xx error — pause queue flush until next connectivity cycle
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
