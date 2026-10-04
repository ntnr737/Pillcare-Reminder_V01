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
export const WATER_CATEGORY = "water-reminder-category";
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
        identifier: "SNOOZE_10",
        buttonTitle: "Snooze 10m",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "SNOOZE_30",
        buttonTitle: "Snooze 30m",
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
      {
        identifier: "LOG_250ML",
        buttonTitle: "✓ Log 250 mL",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "LOG_500ML",
        buttonTitle: "+ Log 500 mL",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "SNOOZE_WATER_15",
        buttonTitle: "Remind 15m",
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
 * Helper to log water intake directly from notification bar actions
 */
async function handleLogWaterFromNotification(amount: number): Promise<void> {
  try {
    const todayDate = new Date().toISOString().split("T")[0];
    const wKey = `water_${todayDate}`;
    const wLoggedKey = `water_logged_${todayDate}`;
    const wLogsKey = `water_logs_${todayDate}`;

    const currentLogged = (await get<number>(wLoggedKey)) || (await get<number>(wKey)) || 0;
    const currentLogs = (await get<Array<{ amount: number; ts: number }>>(wLogsKey)) || [];

    const newAmount = currentLogged + amount;
    const newLogs = [...currentLogs, { amount, ts: Date.now() }];

    await set(wKey, newAmount);
    await set(wLoggedKey, newAmount);
    await set(wLogsKey, newLogs);

    // Sync to backend activity API
    api.createActivity({
      type: "water",
      value: amount,
      unit: "ml",
      note: "Logged from OS notification bar",
    }).catch(() => {});
  } catch (err) {
    console.warn("Failed to log water from notification bar action:", err);
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
      } else if (actionId === "SNOOZE_10" || actionId === "SNOOZE_15" || actionId === "SNOOZE_30") {
        const snoozeSecs = actionId === "SNOOZE_10" ? 600 : actionId === "SNOOZE_30" ? 1800 : 900;
        const snoozeMins = snoozeSecs / 60;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: response.notification.request.content.title,
            body: `[Snoozed ${snoozeMins}m] ${response.notification.request.content.body}`,
            data: data,
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: "default",
            channelId: "medication-reminders",
            priority: Notifications.AndroidNotificationPriority.MAX,
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: snoozeSecs,
          },
        });
      } else if (actionId === "LOG_250ML") {
        await handleLogWaterFromNotification(250);
      } else if (actionId === "LOG_500ML") {
        await handleLogWaterFromNotification(500);
      } else if (actionId === "SNOOZE_WATER_15") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Stay Hydrated! — PillCare Water Reminder",
            body: "[Snoozed 15m] Drink a glass of water (250ml) for optimal cellular hydration.",
            data: { type: "water_reminder" },
            categoryIdentifier: WATER_CATEGORY,
            sound: "default",
            channelId: "hydration-reminders",
            priority: Notifications.AndroidNotificationPriority.HIGH,
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

import { getSoundSettings, getNotificationSoundParam, SoundCategory } from "./soundSettings";

/**
 * Create Android notification channels matching user sound preferences.
 * MUST be called on every app launch before any notification is scheduled.
 * Deletes old channels first so Android OS updates sound/importance settings instantly.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const soundSet = await getSoundSettings();
    const isMuted = soundSet.masterMute;
    const vibrate = soundSet.vibrationEnabled && !isMuted;

    const channels = [
      "medication-reminders",
      "hydration-reminders",
      "appointment-reminders",
      "yoga-reminders",
      "urgent-reminders",
      "broadcasts",
      "silent-reminders",
    ];

    // Delete existing channels to bypass Android channel immutability
    for (const channelId of channels) {
      try {
        await Notifications.deleteNotificationChannelAsync(channelId);
      } catch (err) {}
    }

    const medSound = getNotificationSoundParam(soundSet.categorySounds.medication, isMuted) as string | undefined;
    const waterSound = getNotificationSoundParam(soundSet.categorySounds.water, isMuted) as string | undefined;
    const apptSound = getNotificationSoundParam(soundSet.categorySounds.appointment, isMuted) as string | undefined;
    const yogaSound = getNotificationSoundParam(soundSet.categorySounds.yoga, isMuted) as string | undefined;
    const refillSound = getNotificationSoundParam(soundSet.categorySounds.refill, isMuted) as string | undefined;
    const broadcastSound = getNotificationSoundParam(soundSet.categorySounds.broadcast, isMuted) as string | undefined;

    await Notifications.setNotificationChannelAsync("medication-reminders", {
      name: "Medication Reminders",
      description: "Alerts when it is time to take a medication",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
      sound: medSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 500, 250, 500, 250, 500] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: !isMuted,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("hydration-reminders", {
      name: "Hydration & Water Intake",
      description: "WHO water intake and hydration pacing reminders",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.HIGH,
      sound: waterSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 300, 150, 300] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("appointment-reminders", {
      name: "Doctor Appointments",
      description: "Reminders for scheduled healthcare visits",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.HIGH,
      sound: apptSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 400, 200, 400] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("yoga-reminders", {
      name: "Yoga & Wellness",
      description: "Daily wellness & yoga flow reminders",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.HIGH,
      sound: yogaSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 400, 200, 400] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("urgent-reminders", {
      name: "Urgent Dose & Refill Alerts",
      description: "High priority alerts for critical dose schedules and low stock",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
      sound: refillSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 600, 200, 600, 200, 800] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: !isMuted,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("broadcasts", {
      name: "Updates & Announcements",
      description: "Live alerts and push broadcasts from PillCare Admin",
      importance: isMuted ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
      sound: broadcastSound,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? [0, 400, 200, 400] : undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("silent-reminders", {
      name: "Silent Notifications",
      description: "Visual banner alerts with sound and vibration disabled",
      importance: Notifications.AndroidImportance.LOW,
      sound: undefined,
      enableVibrate: false,
      showBadge: false,
    });
  } catch (e) {
    console.warn("Channel setup failed:", e);
  }
}

/**
 * Trigger an instant test notification for sound and bar verification.
 */
export async function sendTestNotificationNow(
  title = "PillCare Alert Test",
  body = "Notification sound & bar alert working properly!",
  category: SoundCategory = "medication"
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    throw new Error("Notification permission not granted by device OS.");
  }
  await ensureChannels();
  const soundSet = await getSoundSettings();
  const channelId = soundSet.masterMute
    ? "silent-reminders"
    : category === "water"
    ? "hydration-reminders"
    : category === "appointment"
    ? "appointment-reminders"
    : category === "refill"
    ? "urgent-reminders"
    : category === "yoga"
    ? "yoga-reminders"
    : "medication-reminders";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: soundSet.masterMute || soundSet.categorySounds[category] === "mute" ? undefined : "default",
      channelId,
      priority: soundSet.masterMute ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: category === "water" ? WATER_CATEGORY : category === "yoga" ? YOGA_CATEGORY : MEDICATION_CATEGORY,
    } as any,
    trigger: null,
  });
}

/**
 * Post a real-time notification directly to the OS System Notification Bar (Android/iOS status bar).
 */
export async function sendSystemNotificationBarAlert(
  title: string,
  body: string,
  data: any = {}
): Promise<void> {
  try {
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || "PillCare Notification",
        body: body || "You have a new update from PillCare.",
        sound: "default",
        channelId: "broadcasts",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: data,
      } as any,
      trigger: null,
    });
  } catch (e) {
    console.warn("Failed to dispatch system notification bar alert:", e);
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

        // 1. Calculate next upcoming occurrence (today if upcoming, or tomorrow if target time passed today)
        const nextOccurrence = new Date();
        nextOccurrence.setHours(parsed.hour, parsed.minute, 0, 0);
        if (nextOccurrence.getTime() <= now.getTime()) {
          nextOccurrence.setDate(nextOccurrence.getDate() + 1);
        }

        // Schedule exact DATE trigger for next upcoming dose
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
            date: nextOccurrence,
          },
        });

        // 2. Schedule DAILY recurring trigger for long-term daily reminders
        const dailyTrigger: any = Platform.OS === "android"
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: parsed.hour,
              minute: parsed.minute,
              channelId: "medication-reminders",
            }
          : {
              hour: parsed.hour,
              minute: parsed.minute,
              repeats: true,
            };

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
          trigger: dailyTrigger,
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

export async function scheduleYogaReminderFromStore(overrideTime?: Date | string): Promise<void> {
  try {
    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    let timeStr: string | null = null;
    if (overrideTime instanceof Date) {
      const h = String(overrideTime.getHours()).padStart(2, "0");
      const m = String(overrideTime.getMinutes()).padStart(2, "0");
      timeStr = `${h}:${m}`;
    } else if (typeof overrideTime === "string") {
      timeStr = overrideTime;
    } else {
      timeStr = (await get<string>("yoga_reminder_time")) || (await get<string>(K.yogaReminderTime));
    }

    if (!timeStr) return;
    const parsed = parseTime(timeStr);
    if (!parsed) return;

    const time24 = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
    await set("yoga_reminder_time", time24);
    await set(K.yogaReminderTime, time24);

    const yogaTip = await get<any>(K.yogaTip);
    const title = yogaTip?.title || "Daily Medication Yoga Therapy Flow";

    // Cancel existing yoga reminders before scheduling new one
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.categoryIdentifier === YOGA_CATEGORY || notif.content.data?.isYogaReminder) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    // 1. Schedule exact DATE trigger for next upcoming yoga session
    const nextOccurrence = new Date();
    nextOccurrence.setHours(parsed.hour, parsed.minute, 0, 0);
    if (nextOccurrence.getTime() <= Date.now()) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for Your AI Yoga Therapy",
        body: `${title} — Tap to view poses & video guide.`,
        data: { isYogaReminder: true },
        categoryIdentifier: YOGA_CATEGORY,
        sound: "default",
        channelId: "yoga-reminders",
        priority: Notifications.AndroidNotificationPriority.MAX,
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextOccurrence,
      },
    });

    // 2. Schedule DAILY recurring trigger for long-term daily reminders
    const dailyTrigger: any = Platform.OS === "android"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: "yoga-reminders",
        }
      : {
          hour: parsed.hour,
          minute: parsed.minute,
          repeats: true,
        };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for Your AI Yoga Therapy",
        body: `${title} — Tap to view poses & video guide.`,
        data: { isYogaReminder: true },
        categoryIdentifier: YOGA_CATEGORY,
        sound: "default",
        channelId: "yoga-reminders",
        priority: Notifications.AndroidNotificationPriority.MAX,
      } as any,
      trigger: dailyTrigger,
    });

    console.log(`Scheduled daily yoga reminder at ${time24} (next occurrence: ${nextOccurrence.toISOString()})`);
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
      const nextOccurrence = new Date();
      nextOccurrence.setHours(wt.hour, wt.minute, 0, 0);
      if (nextOccurrence.getTime() <= Date.now()) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Stay Hydrated! — PillCare Water Reminder",
          body: "Drink a glass of water (250ml) to assist medicine digestion & maintain healthy hydration.",
          data: { type: "water_reminder" },
          categoryIdentifier: WATER_CATEGORY,
          sound: "default",
          channelId: "hydration-reminders",
          priority: Notifications.AndroidNotificationPriority.HIGH,
        } as any,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextOccurrence,
        },
      });

      const dailyTrigger: any = Platform.OS === "android"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: wt.hour,
            minute: wt.minute,
            channelId: "hydration-reminders",
          }
        : {
            hour: wt.hour,
            minute: wt.minute,
            repeats: true,
          };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Stay Hydrated! — PillCare Water Reminder",
          body: "Drink a glass of water (250ml) to assist medicine digestion & maintain healthy hydration.",
          data: { type: "water_reminder" },
          categoryIdentifier: WATER_CATEGORY,
          sound: "default",
          channelId: "hydration-reminders",
          priority: Notifications.AndroidNotificationPriority.HIGH,
        } as any,
        trigger: dailyTrigger,
      });
    }
    console.log("Scheduled 6 daily hydration reminders");
  } catch (e) {
    console.warn("Water reminder schedule failed:", e);
  }
}

export async function scheduleHydrationPacingReminder(minutesFromNow: number = 15): Promise<void> {
  try {
    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hydration Pacing Reminder",
        body: `15 minutes have passed since your last glass! Time to drink your next 250mL for optimal WHO cellular absorption.`,
        data: { type: "water_pacing_reminder" },
        categoryIdentifier: WATER_CATEGORY,
        sound: "default",
        channelId: "hydration-reminders",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutesFromNow * 60,
        repeats: false,
        channelId: "hydration-reminders",
      },
    });
    console.log(`Scheduled hydration pacing reminder in ${minutesFromNow} minutes`);
  } catch (e) {
    console.warn("Hydration pacing reminder failed:", e);
  }
}

export function addForegroundNotificationReceivedListener(
  onNotification: (notif: { title: string; body: string; data?: any; type?: string }) => void
) {
  const sub = Notifications.addNotificationReceivedListener((event) => {
    try {
      const content = event.request.content;
      onNotification({
        title: content.title || "PillCare Notification",
        body: content.body || "",
        data: content.data,
        type: (content.data as any)?.type || "info",
      });
    } catch (e) {
      console.warn("Foreground notification parse failed:", e);
    }
  });
  return () => sub.remove();
}

/**
 * Schedule 6:00 PM retention reminder to protect daily streak
 */
export async function scheduleDailyStreakSaverReminder(): Promise<void> {
  try {
    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const streakTrigger: any = Platform.OS === "android"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 18,
          minute: 0,
          channelId: "medication-reminders",
        }
      : {
          hour: 18,
          minute: 0,
          repeats: true,
        };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Protect Your Daily Health Streak!",
        body: "Don't break your streak! Log your mandatory water intake & medication doses to keep your rank on the Leaderboard.",
        data: { type: "streak_saver" },
        categoryIdentifier: WATER_CATEGORY,
        sound: "default",
        channelId: "medication-reminders",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: streakTrigger,
    });
  } catch (e) {
    console.warn("Streak saver reminder schedule failed:", e);
  }
}
