import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

export default function Caregiver() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      if (p?.caregiver_phone) setPhone(p.caregiver_phone);
    }).catch(() => {});
    refreshLog();
  }, []);

  const refreshLog = async () => {
    try {
      const j = await api.caregiverLog();
      setLog(j);
    } catch { /* noop */ }
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.upsertProfile({
        nickname: profile.nickname,
        gender: profile.gender,
        year_of_birth: profile.year_of_birth,
        location_city: profile.location_city,
        location_state: profile.location_state,
        phone: profile.phone,
        routine_wake: profile.routine_wake,
        routine_breakfast: profile.routine_breakfast,
        routine_lunch: profile.routine_lunch,
        routine_dinner: profile.routine_dinner,
        routine_sleep: profile.routine_sleep,
        caregiver_phone: phone,
      });
      setMsg("Caregiver saved");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api.caregiverAlert("This is a test alert from PillCare.");
      setMsg(`Sent via ${r.delivered_via}${r.phone ? ` to ${r.phone}` : ""}`);
      refreshLog();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-caregiver">
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Caregiver</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Set a trusted person who gets a WhatsApp message if you skip a dose or run low on stock.</Text>
        <Text style={styles.label}>Caregiver WhatsApp number</Text>
        <TextInput
          testID="caregiver-phone-input"
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 98XXXXXXXX"
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <View style={{ height: 12 }} />
        <PrimaryButton label={saving ? "Saving…" : "Save"} onPress={save} loading={saving} testID="save-caregiver-btn" />
        <View style={{ height: 12 }} />
        <PrimaryButton label={testing ? "Sending…" : "Send test alert"} variant="secondary" onPress={sendTest} loading={testing} testID="send-test-alert-btn" />
        {msg && <Text style={styles.msg} testID="caregiver-msg">{msg}</Text>}

        <Card style={{ marginTop: 24, backgroundColor: theme.colors.surfaceElevated }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.success} />
            <Text style={{ color: theme.colors.success, fontWeight: "700" }}>WhatsApp alerts are live</Text>
          </View>
          <Text style={styles.note}>
            A daily summary is sent automatically at 10 PM, and dose alerts go out in real time via WhatsApp.
          </Text>
        </Card>

        <Text style={[styles.label, { marginTop: 24, fontSize: 16, color: theme.colors.textPrimary, fontWeight: "700" }]}>Recent alerts</Text>
        {log.length === 0 && <Card style={{ marginTop: 8 }}><Text style={{ color: theme.colors.textSecondary }}>No alerts yet.</Text></Card>}
        {log.slice(0, 10).map((l) => (
          <Card key={l.id} style={{ marginTop: 8 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{l.message}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {l.delivered_via} • {new Date(l.sent_at).toLocaleString()}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 32 },
  sub: { color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 22 },
  label: { color: theme.colors.textSecondary, fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, padding: 16, color: theme.colors.textPrimary, fontSize: 18, minHeight: 56 },
  msg: { color: theme.colors.brand, marginTop: 12, textAlign: "center" },
  note: { color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 },
});
