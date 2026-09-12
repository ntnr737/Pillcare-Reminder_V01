/**
 * notifications.ts
 * - Creates Android channels with custom PillCare sounds on EVERY app launch
 * - Registers device for Expo Push Notifications and saves token to backend
 * - Schedules daily medication reminders
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { get, set, K } from "./store";
import Constants from "expo-constants";

// Show notification in foreground always
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn("Failed to set notification handler:", e);
}

export const MEDICATION_CATEGORY = "medication-reminder-category";
export const YOGA_CATEGORY = "yoga-reminder-category";

/**
 * Setup interactive action buttons for device notification bar alerts
 */
export async function ensureCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(MEDICATION_CATEGORY, [
      {
        identifier: "MARK_TAKEN",
        buttonTitle: "✓ Mark as Taken",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "SNOOZE_15",
        buttonTitle: "⏰ Snooze 15m",
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(YOGA_CATEGORY, [
      {
        identifier: "MARK_YOGA_DONE",
        buttonTitle: "🧘 Mark as Done",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "OPEN_YOGA",
        buttonTitle: "▶ Watch Video",
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn("Category setup failed:", e);
  }
}

/**
 * Global listener for interactive notification action buttons tapped from OS notification bar
 */
export function setupNotificationListeners(onNavigate?: (path: string) => void): () => void {
  ensureCategories().catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    try {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data || {};

      if (actionId === "MARK_TAKEN") {
        if (data.medicationId) {
          const medId = String(data.medicationId);
          const nowStr = new Date().toISOString();
          const todayDate = nowStr.split("T")[0];
          api.setDoseStatus(medId, "taken", nowStr).catch(() => {});
          const key = K.doses(todayDate);
          const cached = (await get<any[]>(key)) || [];
          const updated = cached.map((d: any) =>
            d.medication_id === medId || d.id === medId ? { ...d, status: "taken", taken_at: nowStr } : d
          );
          await set(key, updated);
        }
      } else if (actionId === "SNOOZE_15") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: response.notification.request.content.title,
            body: `[Snoozed] ${response.notification.request.content.body}`,
            data: data,
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 900,
          },
        });
      } else if (actionId === "MARK_YOGA_DONE") {
        const todayStr = new Date().toISOString().split("T")[0];
        const yogaDoneKey = `yoga_done_${todayStr}`;
        const steps = [1, 2, 3, 4, 5];
        await set(yogaDoneKey, steps);
        for (const s of steps) {
          api.yogaComplete(s, `Yoga Pose #${s}`, "https://www.youtube.com/watch?v=QPjwawKxuLw").catch(() => {});
        }
      } else if (actionId === "OPEN_YOGA") {
        onNavigate?.("/(tabs)/treatment?openYoga=true");
      }
    } catch (e) {
      console.warn("Notification listener response error:", e);
    }
  });

  return () => sub.remove();
}

/**
 * Create Android notification channels.
 * MUST be called on every app launch before any notification is scheduled.
 * Uses system default sound to ensure 100% compatibility across Expo Go and native builds.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // Try custom PillCare sound first (works in native standalone build with sound-plugin), fallback to default system sound
    try {
      await Notifications.setNotificationChannelAsync("medication-reminders", {
        name: "Medication Reminders",
        description: "Alerts when it is time to take a medication",
        importance: Notifications.AndroidImportance.MAX,
        sound: "pillcare_reminder",
        enableVibrate: true,
        vibrationPattern: [0, 300, 150, 300, 150, 600],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        showBadge: true,
      });
    } catch {
      await Notifications.setNotificationChannelAsync("medication-reminders", {
        name: "Medication Reminders",
        description: "Alerts when it is time to take a medication",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 300, 150, 300, 150, 600],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        showBadge: true,
      });
    }

    try {
      await Notifications.setNotificationChannelAsync("yoga-reminders", {
        name: "Yoga & Wellness",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "pillcare_wellness",
        enableVibrate: true,
        vibrationPattern: [0, 200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      await Notifications.setNotificationChannelAsync("yoga-reminders", {
        name: "Yoga & Wellness",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    try {
      await Notifications.setNotificationChannelAsync("urgent-reminders", {
        name: "Urgent Dose Alerts",
        description: "High priority alerts for critical dose schedules",
        importance: Notifications.AndroidImportance.MAX,
        sound: "pillcare_urgent",
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400, 200, 800],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });
    } catch {
      await Notifications.setNotificationChannelAsync("urgent-reminders", {
        name: "Urgent Dose Alerts",
        description: "High priority alerts for critical dose schedules",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400, 200, 800],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });
    }

    await Notifications.setNotificationChannelAsync("broadcasts", {
      name: "Updates & Announcements",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || "64e98649-8c44-47bb-aa76-d95403ea78c3";
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

    // Local-first medication resolution — reads from AsyncStorage first, falls back to API
    let meds = (await get<any[]>(K.medications)) || [];
    if (!meds || meds.length === 0) {
      try {
        meds = await api.listMedications(true);
      } catch (e) {
        meds = [];
      }
    }

    const activeMeds = (meds || []).filter((m: any) => m.active !== false);
    await Notifications.cancelAllScheduledNotificationsAsync();
    let scheduled = 0;
    for (const med of activeMeds) {
      const times: string[] = Array.isArray(med.times) ? med.times : [];
      for (const t of times) {
        const parsed = parseTime(t);
        if (!parsed) continue;
        const label = med.dosage ? `${med.dosage} ${med.unit || ""}`.trim() : "";
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `PillCare Reminder: ${med.name}`,
            body: label ? `Time to take ${med.name} (${label}). Tap to confirm dose.` : `Time to take ${med.name}. Tap to confirm dose.`,
            data: { medicationId: med.id, scheduledTime: t },
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: "default",
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
    await scheduleWaterReminders().catch(() => {});
    await scheduleYogaReminderFromStore().catch(() => {});
  } catch (e) {
    console.warn("Reminder resync failed:", e);
  }
}

export async function scheduleYogaReminderFromStore(): Promise<void> {
  try {
    const timeStr = await get<string>("yoga_reminder_time");
    if (!timeStr) return;
    const parsed = parseTime(timeStr);
    if (!parsed) return;
    const yogaTip = await get<any>(K.yogaTip);
    const title = yogaTip?.title || "Daily Medication Yoga Therapy";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧘 Time for your Yoga Therapy Routine",
        body: `${title} — Tap to view poses & video guide.`,
        data: { isYogaReminder: true },
        categoryIdentifier: YOGA_CATEGORY,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsed.hour,
        minute: parsed.minute,
        channelId: "yoga-reminders",
      },
    });
    console.log(`Scheduled daily yoga reminder at ${timeStr}`);
  } catch (e) {
    console.warn("Yoga reminder schedule failed:", e);
  }
}

export async function scheduleWaterReminders(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    const waterTimes = [
      { hour: 9, minute: 0 },
      { hour: 11, minute: 30 },
      { hour: 14, minute: 0 },
      { hour: 16, minute: 30 },
      { hour: 19, minute: 0 },
      { hour: 21, minute: 30 },
    ];
    for (const wt of waterTimes) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Stay Hydrated! — PillCare Water Reminder",
          body: "Drink a glass of water (250ml) to assist medicine digestion & maintain healthy hydration.",
          data: { type: "water_reminder" },
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: wt.hour,
          minute: wt.minute,
          channelId: "medication-reminders",
        },
      });
    }
    console.log("Scheduled 6 daily hydration reminders");
  } catch (e) {
    console.warn("Water reminder setup failed:", e);
  }
}
