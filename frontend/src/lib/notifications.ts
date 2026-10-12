/**
 * notifications.ts
 * - Creates Android channels with custom PillCare sounds on EVERY app launch
 * - Registers device for Expo Push Notifications and saves token to backend
 * - Schedules daily medication reminders
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api, localDateStr } from "./api";
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
    }),
  });
} catch (e) {
  console.warn("Failed to set notification handler:", e);
}

export const MEDICATION_CATEGORY = "medication-reminder-category";
export const WATER_CATEGORY = "water-reminder-category";
export const YOGA_CATEGORY = "yoga-reminder-category";

/**
 * Cancel one-shot no-action fallback reminders when user performs any action
 */
export async function cancelFallbackForTag(tag: string): Promise<void> {
  if (!tag) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of all) {
      // CRITICAL: NEVER cancel recurring daily notifications
      const isDaily =
        item.content.data?.isDailyRecurring === true ||
        item.identifier.startsWith("med_daily_") ||
        item.identifier.startsWith("water_daily_") ||
        item.identifier.startsWith("yoga_daily_") ||
        (item.trigger as any)?.repeats === true ||
        (item.trigger as any)?.type === Notifications.SchedulableTriggerInputTypes.DAILY;

      if (isDaily) {
        continue;
      }

      // Only cancel fallback or snoozed items matching this tag
      const isMatchingFallback =
        item.identifier === tag ||
        item.identifier.startsWith(tag) ||
        (item.content.data?.isFallback === true && item.content.data?.fallbackTag === tag);

      if (isMatchingFallback) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  } catch (err) {
    console.warn("Cancel fallback error:", err);
  }
}

/**
 * Setup interactive action buttons for device notification bar alerts (NTF-01, NTF-04)
 */
export async function ensureCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(MEDICATION_CATEGORY, [
      {
        identifier: "MARK_TAKEN",
        buttonTitle: "✓ Mark as Done",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "SNOOZE_10",
        buttonTitle: "Remind me in 10 minutes",
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
        identifier: "SNOOZE_WATER_10",
        buttonTitle: "Remind me in 10 minutes",
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
        buttonTitle: "Open Yoga Flow",
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn("Category setup failed:", e);
  }
}

/**
 * Helper to log water intake directly from notification bar actions using local date (NTF-08)
 * Debounced with 5-second threshold to guarantee idempotency against rapid double taps
 */
let lastWaterLogTime = 0;
async function handleLogWaterFromNotification(amount: number, fallbackTag?: string): Promise<void> {
  const now = Date.now();
  if (now - lastWaterLogTime < 5000) {
    console.log("Debouncing rapid duplicate water log from notification bar");
    return;
  }
  lastWaterLogTime = now;
  try {
    if (fallbackTag) {
      await cancelFallbackForTag(fallbackTag);
    }
    const todayDate = localDateStr();
    const wKey = `water_${todayDate}`;
    const wLoggedKey = `water_logged_${todayDate}`;
    const wLogsKey = `water_logs_${todayDate}`;

    const currentLogged = (await get<number>(wLoggedKey)) || (await get<number>(wKey)) || 0;
    const currentLogs = (await get<Array<{ amount: number; ts: number }>>(wLogsKey)) || [];

    const newAmount = currentLogged + amount;
    const newLogs = [...currentLogs, { amount, ts: now }];

    await set(wKey, newAmount);
    await set(wLoggedKey, newAmount);
    await set(wLogsKey, newLogs);

    // Sync to backend activity API with local date
    api.createActivity({
      type: "water",
      value: amount,
      unit: "ml",
      date: todayDate,
      note: "Logged from OS notification bar",
    }).catch(() => {});
  } catch (err) {
    console.warn("Failed to log water from notification bar action:", err);
  }
}

/**
 * Global listener for interactive notification action buttons tapped from OS notification bar (NTF-01..05)
 */
export function setupNotificationListeners(onNavigate?: (path: string) => void): () => void {
  ensureCategories().catch(() => {});
  let lastHandledResponseId: string | null = null;

  async function processNotificationResponse(
    response: Notifications.NotificationResponse,
    navCallback?: (path: string) => void
  ) {
    try {
      const notifId = response.notification.request.identifier;
      const actionId = response.actionIdentifier;
      const data = (response.notification.request.content.data || {}) as Record<string, any>;
      const fallbackTag = data.fallbackTag || data.reminderInstanceId;

      // Cancel pending no-action fallback whenever any action (or body tap) occurs
      if (fallbackTag) {
        cancelFallbackForTag(fallbackTag).catch(() => {});
      }

      // NTF-03: Type-aware notification body tap routing
      if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        if (!navCallback) return;

        if (data.type === "yoga" || data.isYogaReminder) {
          navCallback("/(tabs)/yoga");
          return;
        }

        if (data.type === "water_reminder" || data.type === "water_pacing_reminder") {
          navCallback("/(tabs)/today?focus=water");
          return;
        }

        if (data.medicationId) {
          navCallback(`/(tabs)/today?focus=medication&medId=${data.medicationId}`);
          return;
        }

        const rawPath = data.path || data.routeKey || data.link_url;
        if (typeof rawPath === "string" && rawPath.startsWith("/")) {
          const basePath = rawPath.split("?")[0];
          const allowlist = ["/(tabs)/today", "/(tabs)/treatment", "/(tabs)/progress", "/(tabs)/profile", "/(tabs)/yoga"];
          if (allowlist.includes(basePath)) {
            navCallback(rawPath);
            return;
          }
        }

        navCallback("/(tabs)/today");
        return;
      }

      // NTF-02: Idempotent mark dose as taken
      if (actionId === "MARK_TAKEN" || actionId === "MARK_DONE") {
        if (data.medicationId) {
          const medId = String(data.medicationId);
          const schedTime = data.scheduledTime ? String(data.scheduledTime) : undefined;
          const nowStr = new Date().toISOString();
          const todayDate = localDateStr();
          const canonicalDoseKey = data.doseId ? String(data.doseId) : `med_${medId}_${todayDate}_${schedTime || "default"}`;

          // 1. Mark local persistent taken registry ONCE under canonical key
          await recordTaken(canonicalDoseKey, todayDate, nowStr);

          // 2. Call backend endpoint to mark dose as taken
          try {
            await api.markTakenByMedication(medId, schedTime, nowStr);
          } catch (err) {
            const { enqueueWrite } = require("./sync");
            await enqueueWrite("doseStatus", { medication_id: medId, scheduled_time: schedTime, taken_at: nowStr, dose_id: canonicalDoseKey }).catch(() => {});
          }

          // 3. Update cached doses array idempotently
          const key = K.doses(todayDate);
          const cached = (await get<any[]>(key)) || [];
          if (cached.length) {
            const updated = cached.map((d: any) =>
              (d.id === canonicalDoseKey || (d.medication_id === medId && (!schedTime || d.scheduled_time === schedTime)))
                ? { ...d, status: "taken", taken_at: nowStr }
                : d
            );
            await set(key, updated);
          }
        }
      } else if (actionId === "SNOOZE_10" || actionId === "SNOOZE_15" || actionId === "SNOOZE_30") {
        // NTF-01: Explicit snooze arms exactly one 10-minute reminder
        const snoozeSecs = 600; // Standard 10 minutes
        const snoozeMins = 10;
        const medId = data.medicationId ? String(data.medicationId) : "general";
        await Notifications.scheduleNotificationAsync({
          identifier: `snooze_med_${medId}_${Date.now()}`,
          content: {
            title: response.notification.request.content.title,
            body: `[Snoozed ${snoozeMins}m] ${response.notification.request.content.body}`,
            data: { ...data, isSnooze: true },
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
        await handleLogWaterFromNotification(250, fallbackTag);
      } else if (actionId === "LOG_500ML") {
        await handleLogWaterFromNotification(500, fallbackTag);
      } else if (actionId === "SNOOZE_WATER_10" || actionId === "SNOOZE_WATER_15") {
        // NTF-04: Explicit water snooze arms exactly one 10-minute reminder
        await Notifications.scheduleNotificationAsync({
          identifier: `snooze_water_${Date.now()}`,
          content: {
            title: "Stay Hydrated! — PillCare Water Reminder",
            body: "[Snoozed 10m] Drink a glass of water (250ml) for optimal cellular hydration.",
            data: { type: "water_reminder", isSnooze: true },
            categoryIdentifier: WATER_CATEGORY,
            sound: "default",
            channelId: "hydration-reminders",
            priority: Notifications.AndroidNotificationPriority.HIGH,
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 600,
          },
        });
      } else if (actionId === "MARK_YOGA_DONE") {
        const todayStr = localDateStr();
        const yogaDoneKey = `yoga_done_${todayStr}`;
        const steps = [1, 2, 3, 4, 5];
        await set(yogaDoneKey, steps);
        for (const s of steps) {
          api.yogaComplete(s, `Yoga Pose #${s}`, "https://www.youtube.com/watch?v=QPjwawKxuLw").catch(() => {});
        }
      } else if (actionId === "OPEN_YOGA") {
        navCallback?.("/(tabs)/yoga");
      }
    } catch (e) {
      console.warn("Notification listener response error:", e);
    }
  }

  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const notifId = response.notification.request.identifier;
    lastHandledResponseId = notifId;
    await processNotificationResponse(response, onNavigate);
  });

  // Check cold start: if launched by tapping a notification while killed
  Notifications.getLastNotificationResponseAsync().then(async (initialResponse) => {
    if (initialResponse) {
      const notifId = initialResponse.notification.request.identifier;
      if (lastHandledResponseId !== notifId) {
        lastHandledResponseId = notifId;
        await processNotificationResponse(initialResponse, onNavigate);
      }
    }
  }).catch(() => {});

  return () => sub.remove();
}

import { getSoundSettings, getNotificationSoundParam, getChannelIdForCategory, SoundCategory } from "./soundSettings";

/**
 * Create Android notification channels matching user sound preferences.
 * MUST be called on every app launch before any notification is scheduled.
 * Uses dynamic channel IDs to bypass Android OS channel settings caching and guarantee fresh sound & vibration parameters.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const soundSet = await getSoundSettings();
    const isMuted = soundSet.masterMute || false;
    const vibrate = soundSet.vibrationEnabled;

    const categories: SoundCategory[] = ["medication", "water", "appointment", "yoga", "refill", "broadcast"];

    for (const cat of categories) {
      try {
        const profile = soundSet.categorySounds[cat] || "default";
        const channelId = getChannelIdForCategory(cat, profile, false, soundSet.vibrationEnabled);

        await Notifications.setNotificationChannelAsync(channelId, {
          name: `PillCare ${cat.charAt(0).toUpperCase() + cat.slice(1)} Alerts`,
          description: `Custom sound alert channel for ${cat}`,
          importance: profile === "mute" ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
          sound: profile === "mute" ? undefined : profile,
          enableVibrate: vibrate,
          vibrationPattern: vibrate ? [0, 500, 250, 500] : undefined,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: profile !== "mute",
          showBadge: true,
        });
      } catch (err) {
        console.warn(`Channel setup error for ${cat}:`, err);
      }
    }

    try {
      await Notifications.setNotificationChannelAsync("pc_silent", {
        name: "Silent Notifications",
        description: "Visual banner alerts with sound and vibration disabled",
        importance: Notifications.AndroidImportance.LOW,
        sound: undefined,
        enableVibrate: false,
        showBadge: false,
      });
    } catch (err) {}
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
  const profile = soundSet.categorySounds[category] || "default";
  const channelId = getChannelIdForCategory(category, profile, false, soundSet.vibrationEnabled);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: getNotificationSoundParam(profile),
      channelId,
      priority: profile === "mute" ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.MAX,
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

let isResyncingReminders = false;
let lastPacingScheduledTs = 0;

export async function resyncReminders(overrideMeds?: any[]): Promise<void> {
  if (isResyncingReminders) {
    return;
  }
  isResyncingReminders = true;
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

    // NTF-07: Cancel ONLY recurring daily medication schedules, preserving active snoozes and per-event timers
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const item of allScheduled) {
        if (item.identifier.startsWith("med_daily_") || (item.content.data?.isDailyRecurring && item.content.data?.medicationId)) {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
        }
      }
    } catch (err) {
      console.warn("Targeted medication cancellation fallback:", err);
    }
    const activeMeds = (meds || []).filter((m: any) => m.active !== false);
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
        const timeClean = t.replace(/[^a-zA-Z0-9]/g, "_");
        const fallbackTag = `fallback_med_${med.id}_${timeClean}`;
        const data = { medicationId: med.id, scheduledTime: t, isDailyRecurring: true, fallbackTag };

        // 1. Calculate next upcoming occurrence (today if upcoming, or tomorrow if target time passed today)
        const nextOccurrence = new Date();
        nextOccurrence.setHours(parsed.hour, parsed.minute, 0, 0);
        if (nextOccurrence.getTime() <= now.getTime()) {
          nextOccurrence.setDate(nextOccurrence.getDate() + 1);
        }

        const soundSet = await getSoundSettings();
        const medProfile = soundSet.categorySounds.medication || "default";
        const medChannel = getChannelIdForCategory("medication", medProfile, soundSet.masterMute, soundSet.vibrationEnabled);
        const medSoundParam = getNotificationSoundParam(medProfile, soundSet.masterMute);

        // Schedule 1 clean DAILY recurring trigger for long-term daily reminders with stable ID
        const dailyTrigger: any = Platform.OS === "android"
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: parsed.hour,
              minute: parsed.minute,
              channelId: medChannel,
            }
          : {
              hour: parsed.hour,
              minute: parsed.minute,
              repeats: true,
            };

        await Notifications.scheduleNotificationAsync({
          identifier: `med_daily_${med.id}_${parsed.hour}_${parsed.minute}`,
          content: {
            title,
            body,
            data,
            categoryIdentifier: MEDICATION_CATEGORY,
            sound: medSoundParam,
            channelId: medChannel,
            priority: soundSet.masterMute ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.MAX,
          } as any,
          trigger: dailyTrigger,
        });

        // NTF-01: Schedule one-shot +5-minute no-action fallback for the next upcoming dose
        const fallbackSecs = Math.max(10, Math.floor((nextOccurrence.getTime() - now.getTime()) / 1000) + 300);
        if (fallbackSecs < 86400) {
          await Notifications.scheduleNotificationAsync({
            identifier: fallbackTag,
            content: {
              title: `Dose Reminder: ${med.name}`,
              body: `[Follow-up] Have you taken ${med.name}? Tap to mark as taken or snooze.`,
              data: { medicationId: med.id, scheduledTime: t, isFallback: true, fallbackTag },
              categoryIdentifier: MEDICATION_CATEGORY,
              sound: medSoundParam,
              channelId: medChannel,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            } as any,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: fallbackSecs,
              repeats: false,
            },
          }).catch(() => {});
        }

        scheduled++;
      }
    }
    console.log(`Scheduled ${scheduled} medication reminders`);
    await scheduleWaterReminders().catch(() => {});
    await scheduleYogaReminderFromStore().catch(() => {});
  } catch (e) {
    console.warn("Reminder resync failed:", e);
  } finally {
    isResyncingReminders = false;
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

    const soundSet = await getSoundSettings();
    const yogaProfile = soundSet.categorySounds.yoga || "default";
    const yogaChannel = getChannelIdForCategory("yoga", yogaProfile, soundSet.masterMute, soundSet.vibrationEnabled);
    const yogaSoundParam = getNotificationSoundParam(yogaProfile, soundSet.masterMute);

    // Cancel existing yoga reminders before scheduling new one
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith("yoga_daily_") || notif.content.categoryIdentifier === YOGA_CATEGORY || notif.content.data?.isYogaReminder) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    // Schedule 1 clean DAILY recurring trigger for long-term daily reminders with stable ID
    const dailyTrigger: any = Platform.OS === "android"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parsed.hour,
          minute: parsed.minute,
          channelId: yogaChannel,
        }
      : {
          hour: parsed.hour,
          minute: parsed.minute,
          repeats: true,
        };

    await Notifications.scheduleNotificationAsync({
      identifier: `yoga_daily_${parsed.hour}_${parsed.minute}`,
      content: {
        title: "Time for Your AI Yoga Therapy",
        body: `${title} — Tap to view poses & video guide.`,
        data: { isYogaReminder: true, type: "yoga" },
        categoryIdentifier: YOGA_CATEGORY,
        sound: yogaSoundParam,
        channelId: yogaChannel,
        priority: soundSet.masterMute ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.MAX,
      } as any,
      trigger: dailyTrigger,
    });

    console.log(`Scheduled daily yoga reminder at ${time24}`);
  } catch (e) {
    console.warn("Yoga reminder schedule failed:", e);
  }
}

export async function scheduleWaterReminders(): Promise<void> {
  try {
    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // NTF-07: Cancel ONLY recurring daily water schedules, preserving snoozes and pacing follow-ups
    const scheduledAll = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduledAll) {
      if (notif.identifier.startsWith("water_daily_")) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    const soundSet = await getSoundSettings();
    const waterProfile = soundSet.categorySounds.water || "default";
    const waterChannel = getChannelIdForCategory("water", waterProfile, soundSet.masterMute, soundSet.vibrationEnabled);
    const waterSoundParam = getNotificationSoundParam(waterProfile, soundSet.masterMute);

    const waterTimes = [
      { hour: 9, minute: 0 },
      { hour: 11, minute: 30 },
      { hour: 14, minute: 0 },
      { hour: 16, minute: 30 },
      { hour: 19, minute: 0 },
      { hour: 21, minute: 30 },
    ];
    const now = new Date();
    for (const wt of waterTimes) {
      const dailyTrigger: any = Platform.OS === "android"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: wt.hour,
            minute: wt.minute,
            channelId: waterChannel,
          }
        : {
            hour: wt.hour,
            minute: wt.minute,
            repeats: true,
          };

      const fallbackTag = `fallback_water_${wt.hour}_${wt.minute}`;
      await Notifications.scheduleNotificationAsync({
        identifier: `water_daily_${wt.hour}_${wt.minute}`,
        content: {
          title: "Stay Hydrated! — PillCare Water Reminder",
          body: "Drink a glass of water (250ml) to assist medicine digestion & maintain healthy hydration.",
          data: { type: "water_reminder", isDailyRecurring: true, fallbackTag },
          categoryIdentifier: WATER_CATEGORY,
          sound: waterSoundParam,
          channelId: waterChannel,
          priority: soundSet.masterMute ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
        } as any,
        trigger: dailyTrigger,
      });

      // NTF-05: Schedule one-shot +10-minute fallback for next upcoming occurrence
      const nextOccurrence = new Date();
      nextOccurrence.setHours(wt.hour, wt.minute, 0, 0);
      if (nextOccurrence.getTime() <= now.getTime()) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 1);
      }
      const fallbackSecs = Math.max(10, Math.floor((nextOccurrence.getTime() - now.getTime()) / 1000) + 600);
      if (fallbackSecs < 86400) {
        await Notifications.scheduleNotificationAsync({
          identifier: fallbackTag,
          content: {
            title: "Hydration Follow-up",
            body: "[Follow-up] Remember to drink your 250ml glass of water to support medication digestion.",
            data: { type: "water_reminder", isFallback: true, fallbackTag },
            categoryIdentifier: WATER_CATEGORY,
            sound: waterSoundParam,
            channelId: waterChannel,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: fallbackSecs,
            repeats: false,
          },
        }).catch(() => {});
      }
    }
    console.log("Scheduled 6 daily hydration reminders with +10m follow-ups");
  } catch (e) {
    console.warn("Water reminder schedule failed:", e);
  }
}

/**
 * NTF-06: Schedule hydration pacing reminder with stable singleton ID and cooldown deduplication
 */
export async function scheduleHydrationPacingReminder(minutesFromNow: number = 10): Promise<void> {
  try {
    const now = Date.now();
    // 15-second debounce cooldown to eliminate rapid-tap duplicate scheduling
    if (now - lastPacingScheduledTs < 15000) {
      return;
    }
    lastPacingScheduledTs = now;

    await ensureChannels();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel existing singleton pacing reminder first
    await Notifications.cancelScheduledNotificationAsync("water_pacing_singleton").catch(() => {});

    const soundSet = await getSoundSettings();
    const waterProfile = soundSet.categorySounds.water || "default";
    const waterChannel = getChannelIdForCategory("water", waterProfile, soundSet.masterMute, soundSet.vibrationEnabled);
    const waterSoundParam = getNotificationSoundParam(waterProfile, soundSet.masterMute);

    await Notifications.scheduleNotificationAsync({
      identifier: "water_pacing_singleton",
      content: {
        title: "Hydration Pacing Reminder",
        body: `${minutesFromNow} minutes have passed since your last glass! Time to drink your next 250mL for optimal cellular absorption.`,
        data: { type: "water_pacing_reminder", fallbackTag: "water_pacing_singleton" },
        categoryIdentifier: WATER_CATEGORY,
        sound: waterSoundParam,
        channelId: waterChannel,
        priority: soundSet.masterMute ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutesFromNow * 60,
        repeats: false,
        channelId: waterChannel,
      },
    });
    console.log(`Scheduled deduplicated hydration pacing reminder in ${minutesFromNow} minutes`);
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
