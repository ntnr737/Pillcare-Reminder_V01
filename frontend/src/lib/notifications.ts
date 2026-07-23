import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

// Ensure foreground notifications show alert + play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android requires a channel to be created before scheduling.
// Importance.MAX ensures the OS actually plays sound and shows heads-up.
async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("medication-reminders", {
    name: "Medication Reminders",
    description: "Alerts when it is time to take a medication",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.warn("Notification permission request failed:", e);
    return false;
  }
}

function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function doseLabel(med: any): string {
  const dosage = med?.dosage;
  const unit = med?.unit || "";
  if (!dosage) return unit;
  return `${dosage} ${unit}`.trim();
}

export async function resyncReminders(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const meds = await api.listMedications(true);
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const med of meds || []) {
      const times: string[] = Array.isArray(med.times) ? med.times : [];
      const label = doseLabel(med);
      for (const t of times) {
        const parsed = parseTime(t);
        if (!parsed) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `\u{1F48A} Time for ${med.name}`,
            body: label ? `${label} — tap to mark as taken` : "Tap to mark as taken",
            data: { medicationId: med.id },
            sound: "default",
            // Android channel is picked up automatically from channelId below
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
            channelId: "medication-reminders",
          },
        });
      }
    }
  } catch (e) {
    console.warn("Notification resync failed:", e);
  }
}
