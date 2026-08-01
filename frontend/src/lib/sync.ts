/**
 * sync.ts — background sync engine
 * Flushes write queue when app comes to foreground.
 */
import { api } from "./api";
import { getQueue, dequeue } from "./store";

let syncing = false;

export async function flushQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const queue = await getQueue();
    for (const item of queue) {
      try {
        switch (item.type) {
          case "doseStatus":
            // Pass taken_at so the server records the correct local time
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
        }
        await dequeue(item.id);
      } catch {
        // Keep in queue — retry next time
      }
    }
  } finally {
    syncing = false;
  }
}

export function backgroundRefresh(fn: () => Promise<void>): void {
  setTimeout(() => {
    fn().catch(() => {});
  }, 50);
}
