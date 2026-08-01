import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

/**
 * Foreground notification handler — always show alert + play sound.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Android notification channel with custom PillCare sound.
 * The sound file must be placed at:
 * android/app/src/main/res/raw/pillcare_reminder.mp3
 *
 * If the custom sound file is not found, Android falls back to default.
 * Custom vibration pattern: two short pulses (medical alert feel).
 */
async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("medication-reminders", {
    name: "Medication Reminders",
    description: "Alerts when it is time to take a medication",
    importance: Notifications.AndroidImportance.MAX,
    // Use custom sound — must match filename in android/app/src/main/res/raw/
    sound: "pillcare_reminder",
    enableVibrate: true,
    // Two short pulses then a longer one — distinct pattern
    vibrationPattern: [0, 300, 150, 300, 150, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
  });

  // Separate channel for yoga reminders — softer
  await Notifications.setNotificationChannelAsync("yoga-reminders", {
    name: "Yoga & Wellness",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "pillcare_wellness",
    enableVibrate: true,
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync({
      android: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === "granted";
  } catch {
    return false;
  }
}

function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10), minute = parseInt(m[2], 10);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function doseLabel(med: any): string {
  const dosage = med?.dosage, unit = med?.unit || "";
  if (!dosage) return unit;
  return `${dosage} ${unit}`.trim();
}

export async function resyncReminders(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const meds = await api.listMedications(true);
    await Notifications.cancelAllScheduledNotificationsAsync();

    let scheduled = 0;
    for (const med of meds || []) {
      const times: string[] = Array.isArray(med.times) ? med.times : [];
      const label = doseLabel(med);

      for (const t of times) {
        const parsed = parseTime(t);
        if (!parsed) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time for ${med.name}`,
            body: label ? `Take ${label} — tap to mark as taken` : "Tap to mark as taken",
            data: { medicationId: med.id, scheduledTime: t },
            sound: "pillcare_reminder",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
            channelId: "medication-reminders",
          },
        });
        scheduled++;
      }
    }
    console.log(`Scheduled ${scheduled} medication reminders`);
  } catch (e) {
    console.warn("Notification resync failed:", e);
  }
}
