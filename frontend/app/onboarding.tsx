import { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { theme } from "@/src/lib/theme";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const CURRENT_YEAR = new Date().getFullYear();

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState(GENDERS[0]);
  const [yob, setYob] = useState(String(CURRENT_YEAR - 30));
  const [routine, setRoutine] = useState({
    routine_wake: "07:00",
    routine_breakfast: "08:00",
    routine_lunch: "13:00",
    routine_dinner: "19:00",
    routine_sleep: "22:00",
  });
  const [activePicker, setActivePicker] = useState<keyof typeof routine | null>(null);
  const [saving, setSaving] = useState(false);

  const next = () => setStep((s) => Math.min(2, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setSaving(true);
    try {
      await api.upsertProfile({
        nickname: nickname.trim() || "Friend",
        gender,
        year_of_birth: parseInt(yob) || CURRENT_YEAR - 30,
        ...routine,
      });
      router.replace("/(tabs)/today");
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? nickname.trim().length > 0 : true;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.progress}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View testID="onboarding-step-1">
            <Text style={styles.h1}>Welcome to PillCare</Text>
            <Text style={styles.sub}>A calmer way to stay on top of your meds. Let&apos;s start with a name we can call you.</Text>
            <Text style={styles.label}>Nickname</Text>
            <TextInput
              testID="nickname-input"
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. Alex"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.input}
              autoFocus
            />
          </View>
        )}

        {step === 1 && (
          <View testID="onboarding-step-2">
            <Text style={styles.h1}>About you</Text>
            <Text style={styles.sub}>This helps tailor reminders and reports. Stays on your device.</Text>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  testID={`gender-${g}`}
                  onPress={() => setGender(g)}
                  style={[styles.chip, gender === g && styles.chipOn]}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextOn]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Year of birth</Text>
            <TextInput
              testID="yob-input"
              value={yob}
              onChangeText={(v) => setYob(v.replace(/[^0-9]/g, "").slice(0, 4))}
              keyboardType="number-pad"
              placeholder="e.g. 1985"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.input}
            />
          </View>
        )}

        {step === 2 && (
          <View testID="onboarding-step-3">
            <Text style={styles.h1}>Your daily routine</Text>
            <Text style={styles.sub}>Reminders will respect your rhythm.</Text>
            {(Object.keys(routine) as (keyof typeof routine)[]).map((k) => (
              <TouchableOpacity
                key={k}
                testID={`routine-${k}`}
                style={styles.routineRow}
                onPress={() => setActivePicker(k)}
              >
                <Text style={styles.routineLabel}>{k.replace("routine_", "").replace(/^./, c => c.toUpperCase())}</Text>
                <Text style={styles.routineTime}>{routine[k]}</Text>
              </TouchableOpacity>
            ))}
            {activePicker && (
              <DateTimePicker
                value={(() => {
                  const [h, m] = routine[activePicker].split(":").map(Number);
                  const d = new Date(); d.setHours(h); d.setMinutes(m); return d;
                })()}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => {
                  const k = activePicker;
                  setActivePicker(null);
                  if (d && k) setRoutine({ ...routine, [k]: fmtTime(d) });
                }}
              />
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <PrimaryButton label="Back" variant="ghost" onPress={back} testID="back-btn" style={{ marginBottom: 8 }} />
        )}
        {step < 2 ? (
          <PrimaryButton label="Continue" onPress={next} disabled={!canNext} testID="continue-btn" />
        ) : (
          <PrimaryButton label="Get Started" onPress={submit} loading={saving} testID="finish-onboarding-btn" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  progress: { flexDirection: "row", gap: 8, padding: 16 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderSubtle },
  dotOn: { backgroundColor: theme.colors.brand },
  body: { padding: 24, paddingBottom: 32 },
  h1: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", marginBottom: 8, letterSpacing: -0.5 },
  sub: { color: theme.colors.textSecondary, fontSize: 16, marginBottom: 24, lineHeight: 22 },
  label: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16, color: theme.colors.textPrimary, fontSize: 18, borderWidth: 1, borderColor: theme.colors.borderSubtle, minHeight: 56 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { color: theme.colors.textSecondary, fontWeight: "600" },
  chipTextOn: { color: theme.colors.textInverse },
  routineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, marginBottom: 8 },
  routineLabel: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" },
  routineTime: { color: theme.colors.brand, fontSize: 18, fontWeight: "700" },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
});
