import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
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

const SOUND_ASSETS: Record<string, any> = {
  chime: require("../../assets/sounds/chime.wav"),
  water_drop: require("../../assets/sounds/water_drop.wav"),
  gentle: require("../../assets/sounds/gentle.wav"),
  pulse: require("../../assets/sounds/pulse.wav"),
  urgent: require("../../assets/sounds/urgent.wav"),
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
 * Map sound profile to Expo Notification sound parameter (Android raw resource name or iOS sound file string)
 */
export function getNotificationSoundParam(profile: SoundProfile, masterMute: boolean): string | boolean | undefined {
  if (masterMute || profile === "mute") {
    return undefined;
  }
  if (profile === "default") {
    return "default";
  }
  return profile;
}

/**
 * Map category, profile & vibration setting to a unique dynamic Android Channel ID.
 * Dynamic suffix forces Android OS to bypass cached channel settings and apply fresh sound & vibration parameters!
 */
export function getChannelIdForCategory(
  category: SoundCategory,
  profile: SoundProfile,
  masterMute: boolean,
  vibrationEnabled = true
): string {
  if (masterMute || profile === "mute") {
    return "pc_silent";
  }
  const vibSuffix = vibrationEnabled ? "v1" : "v0";
  return `pc_${category}_${profile}_${vibSuffix}`;
}

/**
 * Trigger live audio sound preview directly in app for user testing.
 */
export async function playSoundPreview(profile: SoundProfile, vibrationEnabled = true): Promise<void> {
  if (profile === "mute") return;

  // STRICT VIBRATION ENFORCEMENT: Only trigger haptic feedback if vibrationEnabled is explicitly TRUE
  if (vibrationEnabled === true) {
    if (profile === "urgent") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (profile === "water_drop" || profile === "gentle") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  // 1. Direct in-app Audio playback using expo-av
  try {
    const asset = SOUND_ASSETS[profile];
    if (asset) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true, volume: 1.0 });
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
      return;
    }
  } catch (err) {
    console.warn("expo-av playback error:", err);
  }

  // 2. Fallback to notification status bar trigger with dynamic channel ID
  try {
    const channelId = getChannelIdForCategory("medication", profile, false, vibrationEnabled);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Sound Preview: ${SOUND_PROFILE_LABELS[profile].label}`,
        body: SOUND_PROFILE_LABELS[profile].desc,
        sound: getNotificationSoundParam(profile, false),
        channelId: channelId,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any,
      trigger: null,
    });
  } catch (e) {
    console.warn("Notification preview playback error:", e);
  }
}
