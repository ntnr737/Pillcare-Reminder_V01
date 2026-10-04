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
  | "chime"
  | "gentle"
  | "urgent"
  | "water_drop"
  | "default"
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
    water: "chime",
    appointment: "chime",
    refill: "chime",
    yoga: "chime",
    broadcast: "chime",
  },
};

export const SOUND_PROFILE_LABELS: Record<SoundProfile, { label: string; desc: string; icon: string; isSignature?: boolean }> = {
  chime: { label: "🔔 Medical Chime (Default Signature)", desc: "Soft, peaceful 3-tone ascending chime for dose clarity", icon: "sparkles-outline", isSignature: true },
  gentle: { label: "🌿 Gentle Bell", desc: "Soothing acoustic ambient bell tone", icon: "notifications-outline" },
  urgent: { label: "⚡ High Alert Pulse", desc: "Clear, distinct double-beep alert", icon: "alert-circle-outline" },
  water_drop: { label: "💧 Water Drop", desc: "Refreshing fluid drop tone", icon: "water-outline" },
  default: { label: "📱 Phone Default Ringtone", desc: "Standard device notification sound from phone settings", icon: "phone-portrait-outline" },
  mute: { label: "🔇 Muted / Silent", desc: "Visual banner only, no sound", icon: "volume-mute-outline" },
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
