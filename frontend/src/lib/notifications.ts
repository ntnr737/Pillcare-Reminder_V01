import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("medication-reminders", {
        name: "Medication Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    return final === "granted";
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
            title: "Time for your medicine",
            body: label ? `${med.name} - ${label}` : med.name,
            data: { medicationId: med.id },
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
          },
        });
      }
    }
  } catch (e) {
    console.warn("Notification resync failed:", e);
  }
}
