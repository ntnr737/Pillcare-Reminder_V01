import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useFocusEffect } from "expo-router";
import { get, set, K } from "@/src/lib/store";
import { enqueueWrite } from "@/src/lib/sync";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation, SUPPORTED_LANGUAGES, SupportedLocale } from "@/src/context/LanguageContext";
import { ThemeToggleSwitch } from "@/src/components/ThemeToggleSwitch";
import { CountryCodePicker, formatFullWhatsAppPhone } from "@/src/components/CountryCodePicker";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

export default function Profile() {
  const router = useRouter();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const [profile, setProfile] = useState<any>({});
  const [dialCode, setDialCode] = useState("+91");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const load = useCallback(async () => {
    const cached = await get<any>(K.profile);
    if (cached) setProfile(cached);
    try {
      const p = await api.getProfile();
      setProfile(p); set(K.profile, p);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = (key: string, val: any) => {
    setProfile((p: any) => ({ ...p, [key]: val }));
    setChanged(true);
  };

  const save = async () => {
    setSaving(true);
    // 1. Instant local persistence
    await set(K.profile, profile);
    setChanged(false);
    Alert.alert("Saved", "Your profile has been updated.");

    // 2. Network push + offline queue
    try {
      await api.upsertProfile(profile);
    } catch {
      await enqueueWrite("profile", profile);
    } finally { setSaving(false); }
  };

  const ROUTINE_OPTIONS = [
    { key: "routine_morning", label: "Morning", icon: "sunny-outline" },
    { key: "routine_afternoon", label: "Afternoon", icon: "partly-sunny-outline" },
    { key: "routine_evening", label: "Evening", icon: "moon-outline" },
    { key: "routine_night", label: "Night", icon: "star-outline" },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { borderBottomColor: theme.surfaceBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.textPrimary }]}>{t("nav.support", "Profile & Settings")}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Appearance & Language */}
        <Text style={[s.secL, { color: theme.accent }]}>APPEARANCE & LANGUAGE</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.field}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={[s.label, { color: theme.textSecondary }]}>Theme Mode</Text>
              <ThemeToggleSwitch size="md" />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { mode: "dark", label: "Dark", icon: "moon-outline" },
                { mode: "light", label: "Light", icon: "sunny-outline" },
                { mode: "system", label: "System", icon: "options-outline" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.mode}
                  onPress={() => setThemeMode(item.mode as any)}
                  style={[
                    s.chip,
                    { borderColor: theme.surfaceBorder },
                    themeMode === item.mode && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                  ]}
                >
                  <Ionicons name={item.icon as any} size={12} color={themeMode === item.mode ? theme.accent : theme.textSecondary} />
                  <Text style={[s.chipT, { color: themeMode === item.mode ? theme.accent : theme.textSecondary }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[s.field, { marginTop: 4 }]}>
            <Text style={[s.label, { color: theme.textSecondary }]}>App Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => setLocale(lang.code as SupportedLocale)}
                  style={[
                    s.chip,
                    { flexDirection: "row", gap: 4, borderColor: theme.surfaceBorder },
                    locale === lang.code && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                  ]}
                >
                  <Text style={[s.chipT, { color: locale === lang.code ? theme.accent : theme.textSecondary }]}>{lang.nativeName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Identity */}
        <Text style={[s.secL, { color: theme.accent }]}>IDENTITY</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Display Name</Text>
            <TextInput
              value={profile.nickname || ""}
              onChangeText={v => update("nickname", v)}
              placeholder="Your name"
              placeholderTextColor={theme.textDisabled}
              style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
            />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Email Account</Text>
            <Text style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textSecondary, borderColor: theme.surfaceBorder }]}>
              {profile.email || "Registered Google Account"}
            </Text>
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Gender</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {["male", "female", "other", "prefer not to say"].map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => update("gender", g)}
                  style={[
                    s.chip,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    profile.gender === g && { backgroundColor: theme.accentBg, borderColor: theme.accent }
                  ]}
                >
                  <Text style={[s.chipT, { color: theme.textSecondary }, profile.gender === g && { color: theme.accent, fontWeight: "700" }]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Year of Birth</Text>
            <TextInput
              value={profile.year_of_birth ? String(profile.year_of_birth) : ""}
              onChangeText={v => update("year_of_birth", parseInt(v) || "")}
              placeholder="1990"
              placeholderTextColor={theme.textDisabled}
              style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Location */}
        <Text style={[s.secL, { color: theme.accent }]}>LOCATION</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>City</Text>
            <TextInput
              value={profile.location_city || ""}
              onChangeText={v => update("location_city", v)}
              placeholder="Mumbai"
              placeholderTextColor={theme.textDisabled}
              style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
            />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>State / Region</Text>
            <TextInput
              value={profile.location_state || ""}
              onChangeText={v => update("location_state", v)}
              placeholder="Maharashtra"
              placeholderTextColor={theme.textDisabled}
              style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
            />
          </View>
        </View>

        {/* Contact */}
        <Text style={[s.secL, { color: theme.accent }]}>CONTACT</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Phone Number</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <CountryCodePicker
                selectedDialCode={dialCode}
                onSelectCountry={(c) => setDialCode(c.dialCode)}
                style={{ height: 46 }}
              />
              <TextInput
                value={profile.phone || ""}
                onChangeText={v => update("phone", formatFullWhatsAppPhone(dialCode, v))}
                placeholder="98765 43210"
                placeholderTextColor={theme.textDisabled}
                style={[s.inp, { flex: 1, backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                keyboardType="phone-pad"
              />
            </View>
          </View>
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Caregiver WhatsApp</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <CountryCodePicker
                selectedDialCode={dialCode}
                onSelectCountry={(c) => setDialCode(c.dialCode)}
                style={{ height: 46 }}
              />
              <TextInput
                value={profile.caregiver_phone || ""}
                onChangeText={v => update("caregiver_phone", formatFullWhatsAppPhone(dialCode, v))}
                placeholder="98765 43210"
                placeholderTextColor={theme.textDisabled}
                style={[s.inp, { flex: 1, backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={[s.label, { color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }]}>Receives missed-dose alerts via WhatsApp</Text>
            <TouchableOpacity onPress={() => router.push("/caregiver")} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Ionicons name="people-outline" size={13} color={theme.accent} />
              <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700" }}>Manage all caregivers & alert history</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Routine */}
        <Text style={[s.secL, { color: theme.accent }]}>MEDICATION ROUTINE</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[s.label, { color: theme.textSecondary }]}>When do you typically take medications?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {ROUTINE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r.key}
                onPress={() => update(r.key, !profile[r.key])}
                style={[
                  s.routineBtn,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  profile[r.key] && { backgroundColor: theme.accentBg, borderColor: theme.accent }
                ]}
              >
                <Ionicons name={r.icon as any} size={13} color={profile[r.key] ? theme.accent : theme.textSecondary} />
                <Text style={[s.chipT, { color: theme.textSecondary }, profile[r.key] && { color: theme.accent, fontWeight: "700" }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <Text style={[s.secL, { color: theme.accent }]}>NOTIFICATIONS</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={[s.cT, { color: theme.textPrimary }]}>Medication Reminders</Text>
              <Text style={[s.cS, { color: theme.textSecondary }]}>Sound and vibration alerts</Text>
            </View>
            <Switch value={profile.notifications_enabled !== false} onValueChange={v => update("notifications_enabled", v)} trackColor={{ false: theme.surfaceBorder, true: theme.accent }} thumbColor={theme.textPrimary} />
          </View>
        </View>

        {/* Save button */}
        {changed && (
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={save} disabled={saving}>
            <Text style={s.saveTx}>{saving ? "Saving…" : "Save Profile"}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  secL: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  card: { borderRadius: 14, padding: 14, gap: 12, borderWidth: 1 },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: "600" },
  inp: { borderRadius: 10, padding: 12, fontSize: 13, borderWidth: 1 },
  cT: { fontSize: 13, fontWeight: "600" }, cS: { fontSize: 10 },
  chip: { paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipOn: {}, chipT: { fontSize: 11, fontWeight: "600" },
  routineBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1 },
  routineBtnOn: {},
  saveBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  saveTx: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

