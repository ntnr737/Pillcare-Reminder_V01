import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";
import { getFeatures } from "@/src/lib/features";
import { CountryCodePicker, formatFullWhatsAppPhone } from "@/src/components/CountryCodePicker";

export default function Caregiver() {
  const router = useRouter();
  const [caregivers, setCaregivers] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [selectedDialCode, setSelectedDialCode] = useState("+91");
  const [profile, setProfile] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const limit = Math.max(5, getFeatures().caregiver_alerts || 5);

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      const list = p?.caregivers && p.caregivers.length ? p.caregivers : (p?.caregiver_phone ? [p.caregiver_phone] : []);
      setCaregivers(list);
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
    setSaving(true);
    try {
      await api.updateCaregivers(caregivers);
    setMsg("Caregivers saved");
    } catch (e: any) {
      const errMsg = e?.message || "";
      setMsg(errMsg.includes("ERR_") ? errMsg : "Could not save caregivers. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api.caregiverAlert("This is a test alert from PillCare.");
      const sent = r.sent || [r];
      setMsg(`Sent to ${sent.length} caregiver${sent.length === 1 ? "" : "s"}`);
      refreshLog();
    } catch (e: any) {
      const errMsg = e?.message || "";
      setMsg(errMsg.includes("ERR_") ? errMsg : "Could not send test alert. Please check your connection and try again.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/today");
            }
          }}
          testID="back-caregiver"
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Caregiver</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Add trusted people who get a WhatsApp message if you skip a dose or run low on stock. Your plan allows up to {limit} caregiver{limit === 1 ? "" : "s"}.</Text>
        {caregivers.map((c, idx) => (
          <View key={idx} style={styles.caregiverRow}>
            <Text style={styles.caregiverPhone}>{c}</Text>
            <TouchableOpacity onPress={() => setCaregivers(caregivers.filter((_, i) => i !== idx))} testID={`remove-caregiver-${idx}`}>
              <Ionicons name="close-circle" size={22} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        ))}
        {caregivers.length < limit && (
          <View style={styles.addRow}>
            <CountryCodePicker
              selectedDialCode={selectedDialCode}
              onSelectCountry={(c) => setSelectedDialCode(c.dialCode)}
              style={{ height: 56 }}
            />
            <TextInput
              testID="caregiver-phone-input"
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="98765 43210"
              placeholderTextColor={theme.colors.textDisabled}
              keyboardType="phone-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                const raw = newPhone.trim();
                if (!raw) return;
                const fullPhone = formatFullWhatsAppPhone(selectedDialCode, raw);
                if (caregivers.includes(fullPhone)) { setNewPhone(""); return; }
                setCaregivers([...caregivers, fullPhone]);
                setNewPhone("");
              }}
              testID="add-caregiver-btn"
            >
              <Ionicons name="add" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
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
  caregiverRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, padding: 14, marginBottom: 10 },
  caregiverPhone: { color: theme.colors.textPrimary, fontSize: 16 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addBtn: { width: 56, height: 56, borderRadius: 12, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
});
