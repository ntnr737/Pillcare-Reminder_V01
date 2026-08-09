/**
 * notifications.ts
 * - Creates Android channels with custom PillCare sounds on EVERY app launch
 * - Registers device for Expo Push Notifications and saves token to backend
 * - Schedules daily medication reminders
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import Constants from "expo-constants";

// Show notification in foreground always
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Create Android notification channels.
 * MUST be called on every app launch before any notification is scheduled.
 * Sound file must exist at android/app/src/main/res/raw/pillcare_reminder.wav
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("medication-reminders", {
      name: "Medication Reminders",
      description: "Alerts when it is time to take a medication",
      importance: Notifications.AndroidImportance.MAX,
      sound: "pillcare_reminder",   // maps to res/raw/pillcare_reminder.wav
      enableVibrate: true,
      vibrationPattern: [0, 300, 150, 300, 150, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync("yoga-reminders", {
      name: "Yoga & Wellness",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "pillcare_wellness",
      enableVibrate: true,
      vibrationPattern: [0, 200, 100, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync("broadcasts", {
      name: "Updates & Announcements",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "pillcare_reminder",
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (e) {
    console.warn("Channel setup failed:", e);
  }
}

/**
 * Request permission and get Expo push token.
 * Saves token to backend so admin can send notifications to all users.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (__DEV__ && Platform.OS !== "android" && Platform.OS !== "ios") return null;
  try {
    await ensureChannels();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // Get Expo push token — works with FCM under the hood
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || "1828aee8-d92a-4017-8612-973ae0c1546d";
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = token.data;

    // Save to backend silently
    api.savePushToken(pushToken).catch(() => {});
    return pushToken;
  } catch (e) {
    console.warn("Push token registration failed:", e);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannels();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10), minute = parseInt(m[2], 10);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
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
      for (const t of times) {
        const parsed = parseTime(t);
        if (!parsed) continue;
        const label = med.dosage ? `${med.dosage} ${med.unit || ""}`.trim() : "";
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
    console.log(`Scheduled ${scheduled} reminders`);
  } catch (e) {
    console.warn("Reminder resync failed:", e);
  }
}
