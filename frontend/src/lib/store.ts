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
  appointments: "appointments",
  writeQueue: "write_queue",
};

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
