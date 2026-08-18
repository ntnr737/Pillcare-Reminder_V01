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

type WriteItem = {
  id: string;
  ts: number;
  type: string;
  payload: any;
};

async function getQueue(): Promise<WriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function removeFromQueue(id: string): Promise<void> {
  try {
    const q = await getQueue();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(i => i.id !== id)));
  } catch {}
}

export async function enqueueWrite(type: string, payload: any): Promise<string> {
  const id = `${Date.now()}_${Math.random()}`;
  try {
    const q = await getQueue();
    q.push({ id, ts: Date.now(), type, payload });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
  return id;
}

/**
 * Flush all pending writes to the server.
 * Call this BEFORE fetching fresh data from server.
 */
export async function flushQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const queue = await getQueue();
    for (const item of queue) {
      try {
        switch (item.type) {
          case "doseStatus":
            await api.setDoseStatus(item.payload.id, item.payload.status, item.payload.taken_at);
            break;
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
        }
        await removeFromQueue(item.id);
      } catch {
        // Network still unavailable — keep in queue, retry next flush
        break; // stop trying if network is down
      }
    }
  } finally {
    syncing = false;
  }
}

export function backgroundRefresh(fn: () => Promise<void>): void {
  setTimeout(() => fn().catch(() => {}), 50);
}
