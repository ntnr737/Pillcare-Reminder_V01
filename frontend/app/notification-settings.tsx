import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import {
  getSoundSettings,
  saveSoundSettings,
  playSoundPreview,
  SoundCategory,
  SoundProfile,
  SoundSettings,
  SOUND_PROFILE_LABELS,
  DEFAULT_SOUND_SETTINGS,
} from "@/src/lib/soundSettings";
import { sendTestNotificationNow, ensureChannels } from "@/src/lib/notifications";

const CATEGORIES: Array<{ key: SoundCategory; title: string; subtitle: string; icon: string; defaultColor: string }> = [
  { key: "medication", title: "Medication Reminders", subtitle: "Scheduled dose alerts & pill reminders", icon: "medical-outline", defaultColor: "#4f46e5" },
  { key: "water", title: "Water & Hydration", subtitle: "WHO hydration pacing & water logs", icon: "water-outline", defaultColor: "#0284c7" },
  { key: "appointment", title: "Doctor Appointments", subtitle: "Medical visits & health checkups", icon: "calendar-outline", defaultColor: "#059669" },
  { key: "refill", title: "Refill & Low Stock Alerts", subtitle: "Critical supply warnings & stock limits", icon: "warning-outline", defaultColor: "#dc2626" },
  { key: "yoga", title: "Yoga & Wellness", subtitle: "Daily wellness flows & stretch exercises", icon: "body-outline", defaultColor: "#d97706" },
];

const PROFILES: SoundProfile[] = ["chime", "water_drop", "gentle", "pulse", "urgent", "default", "mute"];

export default function NotificationSettingsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [testingCategory, setTestingCategory] = useState<SoundCategory | null>(null);

  useEffect(() => {
    getSoundSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateMasterMute = async (val: boolean) => {
    const updated = { ...settings, masterMute: val };
    setSettings(updated);
    await saveSoundSettings(updated);
    await ensureChannels();
  };

  const updateVibration = async (val: boolean) => {
    const updated = { ...settings, vibrationEnabled: val };
    setSettings(updated);
    await saveSoundSettings(updated);
    await ensureChannels();
  };

  const updateCategorySound = async (category: SoundCategory, profile: SoundProfile) => {
    const updated = {
      ...settings,
      categorySounds: {
        ...settings.categorySounds,
        [category]: profile,
      },
    };
    setSettings(updated);
    await saveSoundSettings(updated);
    await ensureChannels();
  };

  const handleTestPreview = async (profile: SoundProfile) => {
    await playSoundPreview(profile, settings.vibrationEnabled);
  };

  const handleSendTestNotification = async (category: SoundCategory) => {
    setTestingCategory(category);
    try {
      const catObj = CATEGORIES.find((c) => c.key === category);
      await sendTestNotificationNow(
        `PillCare Test Alert: ${catObj?.title || category}`,
        `Testing sound profile: ${SOUND_PROFILE_LABELS[settings.categorySounds[category]]?.label}`,
        category
      );
      Alert.alert(
        "Notification Sent",
        "Check your status bar notification pop-up to hear the alert tone!"
      );
    } catch (e) {
      Alert.alert("Error", "Could not dispatch test notification.");
    } finally {
      setTestingCategory(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]}>
        <View style={s.loaderWrap}>
          <Text style={{ color: theme.textSecondary }}>Loading sound profiles…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={[s.hdr, { borderBottomColor: theme.surfaceBorder }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.textPrimary }]}>Notification Sounds & Controls</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[s.bannerCard, { backgroundColor: isDark ? "rgba(79,70,229,0.15)" : "rgba(79,70,229,0.08)", borderColor: "rgba(79,70,229,0.3)" }]}>
          <View style={s.bannerRow}>
            <View style={[s.iconBox, { backgroundColor: "#4f46e5" }]}>
              <Ionicons name="volume-high" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: theme.textPrimary }]}>Custom Recall Chimes</Text>
              <Text style={[s.bannerSub, { color: theme.textSecondary }]}>
                Distinct sounds per notification category so you know instantly what PillCare is reminding you about.
              </Text>
            </View>
          </View>
        </View>

        {/* Master Controls Section */}
        <Text style={[s.secL, { color: theme.accent }]}>MASTER SOUND CONTROLS</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Ionicons
                name={settings.masterMute ? "volume-mute" : "volume-high"}
                size={20}
                color={settings.masterMute ? "#f87171" : theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.cT, { color: theme.textPrimary }]}>Notification Sound</Text>
                <Text style={[s.cS, { color: theme.textSecondary }]}>
                  {settings.masterMute ? "Muted — visual banners only" : "Enabled — playing recall chimes"}
                </Text>
              </View>
            </View>
            <Switch
              value={!settings.masterMute}
              onValueChange={(val) => updateMasterMute(!val)}
              trackColor={{ false: theme.surfaceBorder, true: theme.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[s.divider, { backgroundColor: theme.surfaceBorder }]} />

          <View style={s.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Ionicons name="hardware-chip-outline" size={20} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.cT, { color: theme.textPrimary }]}>Haptic Vibration</Text>
                <Text style={[s.cS, { color: theme.textSecondary }]}>Vibrate on incoming notification alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={updateVibration}
              trackColor={{ false: theme.surfaceBorder, true: theme.accent }}
              thumbColor="#fff"
              disabled={settings.masterMute}
            />
          </View>
        </View>

        {/* Category Profiles Section */}
        <Text style={[s.secL, { color: theme.accent }]}>CATEGORY RECALL SOUND PROFILES</Text>

        {CATEGORIES.map((cat) => {
          const currentProfile = settings.categorySounds[cat.key] || "default";
          const profileInfo = SOUND_PROFILE_LABELS[currentProfile];

          return (
            <View
              key={cat.key}
              style={[
                s.catCard,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                settings.masterMute && { opacity: 0.6 },
              ]}
            >
              {/* Category Header */}
              <View style={s.catHeaderRow}>
                <View style={[s.catIconCircle, { backgroundColor: cat.defaultColor }]}>
                  <Ionicons name={cat.icon as any} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.catTitle, { color: theme.textPrimary }]}>{cat.title}</Text>
                  <Text style={[s.catSub, { color: theme.textSecondary }]}>{cat.subtitle}</Text>
                </View>
                <TouchableOpacity
                  style={[s.testBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.bg }]}
                  onPress={() => handleSendTestNotification(cat.key)}
                  disabled={settings.masterMute || testingCategory === cat.key}
                >
                  <Ionicons name="notifications-circle-outline" size={16} color={theme.accent} />
                  <Text style={[s.testBtnText, { color: theme.accent }]}>
                    {testingCategory === cat.key ? "Sending…" : "Test Bar"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Selected Profile Highlight */}
              <View style={[s.activeProfileBar, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={profileInfo.icon as any} size={14} color={theme.accent} />
                  <Text style={[s.activeProfileName, { color: theme.textPrimary }]}>{profileInfo.label}</Text>
                </View>
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleTestPreview(currentProfile)} disabled={settings.masterMute}>
                  <Ionicons name="volume-medium-outline" size={14} color={theme.accent} />
                  <Text style={[s.previewBtnText, { color: theme.accent }]}>Play Chime</Text>
                </TouchableOpacity>
              </View>

              {/* Sound Profile Selector Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {PROFILES.map((p) => {
                  const isSelected = currentProfile === p;
                  const labelObj = SOUND_PROFILE_LABELS[p];

                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        s.profileChip,
                        { borderColor: theme.surfaceBorder, backgroundColor: theme.bg },
                        isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                      onPress={() => {
                        updateCategorySound(cat.key, p);
                        handleTestPreview(p);
                      }}
                      disabled={settings.masterMute}
                    >
                      <Ionicons
                        name={labelObj.icon as any}
                        size={12}
                        color={isSelected ? "#fff" : theme.textSecondary}
                      />
                      <Text style={[s.chipLabel, { color: theme.textSecondary }, isSelected && { color: "#fff", fontWeight: "700" }]}>
                        {labelObj.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  body: { padding: 16, gap: 14 },
  bannerCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: 14, fontWeight: "700" },
  bannerSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  secL: { fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 4 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, marginVertical: 2 },
  cT: { fontSize: 13, fontWeight: "600" },
  cS: { fontSize: 10, marginTop: 1 },
  catCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10 },
  catHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  catIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  catTitle: { fontSize: 13, fontWeight: "700" },
  catSub: { fontSize: 10 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
  },
  testBtnText: { fontSize: 10, fontWeight: "700" },
  activeProfileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeProfileName: { fontSize: 11, fontWeight: "600" },
  previewBtnText: { fontSize: 10, fontWeight: "700" },
  chipRow: { gap: 6, paddingTop: 2 },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 10, fontWeight: "500" },
});
