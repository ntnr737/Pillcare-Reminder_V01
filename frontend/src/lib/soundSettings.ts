import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
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
 * Map sound profile to Expo Notification sound parameter.
 * Returns the profile sound filename (e.g., "chime", "water_drop") or undefined for mute.
 */
export function getNotificationSoundParam(profile: SoundProfile, masterMute: boolean = false): string | boolean | undefined {
  if (masterMute || profile === "mute") {
    return undefined;
  }
  return profile;
}

/**
 * Map category, profile & vibration setting to a unique dynamic Android Channel ID.
 */
export function getChannelIdForCategory(
  category: SoundCategory,
  profile: SoundProfile,
  masterMute: boolean = false,
  vibrationEnabled = true
): string {
  if (masterMute || profile === "mute") {
    return "pc_silent";
  }
  return `pc_${category}_${profile}_v1`;
}

/**
 * Trigger live audio sound preview directly in app for user testing.
 */
export async function playSoundPreview(profile: SoundProfile): Promise<void> {
  if (profile === "mute") return;

  // Safe notification sound & status bar preview trigger without native expo-av crash risk
  try {
    const channelId = getChannelIdForCategory("medication", profile, false, true);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Sound Preview: ${SOUND_PROFILE_LABELS[profile].label}`,
        body: SOUND_PROFILE_LABELS[profile].desc,
        sound: getNotificationSoundParam(profile),
        channelId: channelId,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: null,
    });
  } catch (e) {
    console.warn("Notification preview playback error:", e);
  }
}
