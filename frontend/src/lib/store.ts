/**
 * store.ts — local-first data store
 * All reads come from here instantly. Server syncs in background.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const P = "pc6_";

export async function get<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(P + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function set(key: string, value: any): Promise<void> {
  try {
    await AsyncStorage.setItem(P + key, JSON.stringify(value));
  } catch {}
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(P + key);
  } catch {}
}

export const K = {
  doses: (date: string) => `doses_${date}`,
  profile: "profile",
  streak: "streak",
  medications: "medications",
  measurements: "measurements",
  activities: "activities",
  mood: "mood",
  adherence: "adherence_7d",
  history: "dose_history_30d",
  aiMsg: "ai_msg",
  yogaTip: "yoga_tip",
  yogaReminderTime: "yoga_reminder_time",
  appointments: "appointments",
  mindfulSeconds: "mindful_practice_seconds",
  writeQueue: "write_queue",
  seenNotifIds: "seen_notif_ids",
  firstInstalledAt: "first_installed_at",
};

export async function getAppInstallTimestamp(): Promise<number> {
  try {
    let ts = await get<number>(K.firstInstalledAt);
    if (!ts) {
      ts = Date.now();
      await set(K.firstInstalledAt, ts);
    }
    return ts;
  } catch {
    return Date.now();
  }
}

export async function markNotifSeen(id: string): Promise<void> {
  if (!id) return;
  try {
    const list = (await get<string[]>(K.seenNotifIds)) || [];
    if (!list.includes(id)) {
      list.push(id);
      // Keep max last 200 seen IDs to avoid unlimited growth
      const trimmed = list.slice(-200);
      await set(K.seenNotifIds, trimmed);
    }
  } catch {}
}

export async function getSeenNotifIds(): Promise<string[]> {
  try {
    return (await get<string[]>(K.seenNotifIds)) || [];
  } catch {
    return [];
  }
}

// Write queue for offline writes
export type WriteItem = {
  id: string;
  ts: number;
  type: string;
  payload: any;
};

export async function enqueue(type: string, payload: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(P + K.writeQueue);
    const q: WriteItem[] = raw ? JSON.parse(raw) : [];
    q.push({ id: Math.random().toString(36).slice(2), ts: Date.now(), type, payload });
    await AsyncStorage.setItem(P + K.writeQueue, JSON.stringify(q));
  } catch {}
}

export async function dequeue(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(P + K.writeQueue);
    if (!raw) return;
    const q: WriteItem[] = JSON.parse(raw);
    await AsyncStorage.setItem(P + K.writeQueue, JSON.stringify(q.filter((i) => i.id !== id)));
  } catch {}
}

export async function getQueue(): Promise<WriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(P + K.writeQueue);
    if (!raw) return [];
    const q: WriteItem[] = JSON.parse(raw);
    return q.filter((i) => Date.now() - i.ts < 48 * 3600 * 1000);
  } catch {
    return [];
  }
}

export async function logCourseCompleted(
  medId: string,
  medName: string,
  genericName: string = "",
  dosage: string = "",
  unit: string = "",
  takenPillsCount: number = 0
): Promise<void> {
  try {
    const d = new Date();
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const historyCache = (await get<any[]>(K.history)) || [];

    let dayItem = historyCache.find((item: any) => item.date === dStr);
    if (!dayItem) {
      dayItem = { date: dStr, total: 0, taken: 0, entries: [] };
      historyCache.unshift(dayItem);
    }

    const pillsText = takenPillsCount > 0 ? ` • Total ${takenPillsCount} doses taken` : "";
    const newEntry = {
      id: `course_completed_${medId}_${Date.now()}`,
      name: `${medName} — Course Completed`,
      generic_name: genericName,
      dosage: dosage,
      unit: unit,
      time: hStr,
      status: "course_completed",
      note: `Treatment course completed${pillsText}`,
    };
    if (!dayItem.entries.some((e: any) => e.id === newEntry.id)) {
      dayItem.entries.unshift(newEntry);
    }
    await set(K.history, [...historyCache]);
  } catch (e) {
    console.warn("Failed to log course completed to history:", e);
  }
}
