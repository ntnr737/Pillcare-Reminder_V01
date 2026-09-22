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
import { recordTaken } from "./sync";
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
      priority: Notifications.AndroidNotificationPriority.MAX,
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
        buttonTitle: "Snooze 15m",
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(YOGA_CATEGORY, [
      {
        identifier: "MARK_YOGA_DONE",
        buttonTitle: "Mark as Done",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "OPEN_YOGA",
        buttonTitle: "Watch Video",
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

      if (actionId === "MARK_TAKEN" || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        if (data.medicationId) {
          const medId = String(data.medicationId);
          const schedTime = data.scheduledTime ? String(data.scheduledTime) : undefined;
          const nowStr = new Date().toISOString();
          const todayDate = nowStr.split("T")[0];

          // 1. Mark local persistent taken registry immediately (offline-first, zero latency)
          if (data.doseId) {
            await recordTaken(String(data.doseId), todayDate, nowStr);
          }
          await recordTaken(medId, todayDate, nowStr);

          // 2. Call backend endpoint to mark dose as taken and update stock in database
          try {
            await api.markTakenByMedication(medId, schedTime, nowStr);
          } catch (err) {
            console.warn("Server mark taken failed, enqueued locally:", err);
          }

          // 3. Update cached doses array in AsyncStorage so UI updates instantly when app opens
          const key = K.doses(todayDate);
          const cached = (await get<any[]>(key)) || [];
          if (cached.length) {
            const updated = cached.map((d: any) =>
              d.medication_id === medId || d.id === medId || (d.medication_id === medId && d.scheduled_time === schedTime)
                ? { ...d, status: "taken", taken_at: nowStr }
                : d
            );
            await set(key, updated);
          }
        }
      } else if (actionId === "SNOOZE_15") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: response.notification.request.content.title,
            body: `[Snoozed] ${response.notification.request.content.body}`,
            data: data,
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: "default",
            channelId: "medication-reminders",
            priority: Notifications.AndroidNotificationPriority.MAX,
          } as any,
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
 * Sets MAX importance, high-vibration pattern, and public lockscreen visibility.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("medication-reminders", {
      name: "Medication Reminders",
      description: "Alerts when it is time to take a medication",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("yoga-reminders", {
      name: "Yoga & Wellness",
      description: "Daily wellness & yoga flow reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("urgent-reminders", {
      name: "Urgent Dose Alerts",
      description: "High priority alerts for critical dose schedules",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 600, 200, 600, 200, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

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
 * Trigger an instant test notification for sound and bar verification.
 */
export async function sendTestNotificationNow(title = "PillCare Alert Test", body = "Notification sound & bar alert working properly!"): Promise<void> {
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      channelId: "medication-reminders",
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: MEDICATION_CATEGORY,
    } as any,
    trigger: null,
  });
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

export function parseTime(t: string): { hour: number; minute: number } | null {
  if (!t || typeof t !== "string") return null;
  const cleaned = t.trim().toLowerCase();

  // 12-Hour format with AM/PM (e.g. "8:30 am", "08:30 pm")
  const ampmMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/.exec(cleaned);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  // 24-Hour format (e.g. "08:30", "8:30", "18:30", "18:30:00")
  const match24 = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(cleaned);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  return null;
}

export async function resyncReminders(overrideMeds?: any[]): Promise<void> {
  try {
    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Local-first medication resolution — reads from AsyncStorage first, falls back to API
    let meds = overrideMeds || (await get<any[]>(K.medications)) || [];
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
    const now = new Date();

    for (const med of activeMeds) {
      const times: string[] = Array.isArray(med.times) ? med.times : [];
      for (const t of times) {
        const parsed = parseTime(t);
        if (!parsed) continue;
        const label = med.dosage ? `${med.dosage} ${med.unit || ""}`.trim() : "";
        const title = `PillCare Reminder: ${med.name}`;
        const body = label ? `Time to take ${med.name} (${label}). Tap to confirm dose.` : `Time to take ${med.name}. Tap to confirm dose.`;
        const data = { medicationId: med.id, scheduledTime: t };

        // 1. If dose time is TODAY and upcoming (e.g. 2-3 mins after current time), schedule an EXACT DATE trigger
        const targetToday = new Date();
        targetToday.setHours(parsed.hour, parsed.minute, 0, 0);

        if (targetToday.getTime() > now.getTime()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data,
              categoryIdentifier: MEDICATION_CATEGORY,
              sound: "default",
              channelId: "medication-reminders",
              priority: Notifications.AndroidNotificationPriority.MAX,
            } as any,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetToday,
            },
          });
        }

        // 2. Schedule DAILY recurring trigger for long-term daily reminders
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: "default",
            channelId: "medication-reminders",
            priority: Notifications.AndroidNotificationPriority.MAX,
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
            channelId: "medication-reminders",
          } as any,
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
    await ensureChannels();
    const timeStr = (await get<string>("yoga_reminder_time")) || (await get<string>(K.yogaReminderTime));
    if (!timeStr) return;
    const parsed = parseTime(timeStr);
    if (!parsed) return;
    const yogaTip = await get<any>(K.yogaTip);
    const title = yogaTip?.title || "Daily Medication Yoga Therapy Flow";

    // Cancel existing yoga reminders before scheduling new one
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.categoryIdentifier === YOGA_CATEGORY || notif.content.data?.isYogaReminder) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧘 Time for Your AI Yoga Therapy",
        body: `${title} — Tap to view poses & video guide.`,
        data: { isYogaReminder: true },
        categoryIdentifier: YOGA_CATEGORY,
        sound: "default",
        channelId: "yoga-reminders",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsed.hour,
        minute: parsed.minute,
        channelId: "yoga-reminders",
      } as any,
    });
    console.log(`Scheduled daily yoga reminder at ${parsed.hour}:${String(parsed.minute).padStart(2, "0")}`);
  } catch (e) {
    console.warn("Yoga reminder schedule failed:", e);
  }
}

export async function scheduleWaterReminders(): Promise<void> {
  try {
    await ensureChannels();
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
          title: "Stay Hydrated! — PillCare Water Reminder",
          body: "Drink a glass of water (250ml) to assist medicine digestion & maintain healthy hydration.",
          data: { type: "water_reminder" },
          sound: "default",
          channelId: "medication-reminders",
          priority: Notifications.AndroidNotificationPriority.HIGH,
        } as any,
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
