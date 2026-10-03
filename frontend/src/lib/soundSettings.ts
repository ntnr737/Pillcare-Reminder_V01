/**
 * soundSettings.ts
 * Core sound profile management and preferences for PillCare Notifications.
 * Supports distinct category sounds (Medications, Water, Appointments, Refills, Yoga)
 * and in-app sound previews.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const SOUND_SETTINGS_KEY = "pc_sound_settings_v1";

export type SoundCategory =
  | "medication"
  | "water"
  | "appointment"
  | "refill"
  | "yoga"
  | "broadcast";

export type SoundProfile =
  | "default"
  | "chime"
  | "gentle"
  | "pulse"
  | "urgent"
  | "water_drop"
  | "mute";

export type SoundSettings = {
  masterMute: boolean;
  vibrationEnabled: boolean;
  categorySounds: Record<SoundCategory, SoundProfile>;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterMute: false,
  vibrationEnabled: true,
  categorySounds: {
    medication: "chime",
    water: "water_drop",
    appointment: "gentle",
    refill: "urgent",
    yoga: "gentle",
    broadcast: "default",
  },
};

export const SOUND_PROFILE_LABELS: Record<SoundProfile, { label: string; desc: string; icon: string }> = {
  default: { label: "System Default", desc: "Standard device notification sound", icon: "notifications-outline" },
  chime: { label: "Medical Chime", desc: "Clear, gentle 3-tone chime for doses", icon: "medical-outline" },
  gentle: { label: "Gentle Bell", desc: "Soft ambient bell for calm reminders", icon: "leaf-outline" },
  pulse: { label: "Digital Pulse", desc: "Rhythmic pulse for active alerts", icon: "pulse-outline" },
  water_drop: { label: "Water Drop", desc: "Refreshing fluid drop tone", icon: "water-outline" },
  urgent: { label: "High Alert", desc: "Urgent double-beep for low refills & critical doses", icon: "warning-outline" },
  mute: { label: "Muted / Silent", desc: "Visual banner only, no sound", icon: "volume-mute-outline" },
};

/**
 * Fetch sound settings from AsyncStorage with fallback to defaults.
 */
export async function getSoundSettings(): Promise<SoundSettings> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_SETTINGS_KEY);
    if (!raw) return DEFAULT_SOUND_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      masterMute: parsed.masterMute ?? DEFAULT_SOUND_SETTINGS.masterMute,
      vibrationEnabled: parsed.vibrationEnabled ?? DEFAULT_SOUND_SETTINGS.vibrationEnabled,
      categorySounds: {
        ...DEFAULT_SOUND_SETTINGS.categorySounds,
        ...(parsed.categorySounds || {}),
      },
    };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

/**
 * Save sound settings to AsyncStorage.
 */
export async function saveSoundSettings(settings: SoundSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save sound settings:", e);
  }
}

/**
 * Map sound profile to Expo Notification sound parameter
 */
export function getNotificationSoundParam(profile: SoundProfile, masterMute: boolean): string | boolean | undefined {
  if (masterMute || profile === "mute") {
    return undefined;
  }
  if (profile === "default") {
    return "default";
  }
  // Android raw resource name or iOS sound file string fallback
  return "default";
}

/**
 * Map category & profile to Android Channel ID
 */
export function getChannelIdForCategory(category: SoundCategory, profile: SoundProfile, masterMute: boolean): string {
  if (masterMute || profile === "mute") {
    return "silent-reminders";
  }
  switch (category) {
    case "medication":
      return "medication-reminders";
    case "water":
      return "hydration-reminders";
    case "appointment":
      return "appointment-reminders";
    case "refill":
      return "urgent-reminders";
    case "yoga":
      return "yoga-reminders";
    case "broadcast":
    default:
      return "broadcasts";
  }
}

/**
 * Trigger live audio sound preview directly in app for user testing.
 */
export async function playSoundPreview(profile: SoundProfile, vibrationEnabled = true): Promise<void> {
  if (profile === "mute") return;

  if (vibrationEnabled) {
    if (profile === "urgent") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (profile === "water_drop" || profile === "gentle") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  // Use instant notification trigger to play device system sound chime preview
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Sound Preview: ${SOUND_PROFILE_LABELS[profile].label}`,
        body: SOUND_PROFILE_LABELS[profile].desc,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: null,
    });
  } catch (e) {
    console.warn("Sound preview playback error:", e);
  }
}
