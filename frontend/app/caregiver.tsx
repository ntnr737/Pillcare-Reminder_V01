import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
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

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      if (p?.caregiver_phone) setPhone(p.caregiver_phone);
    }).catch(() => {});
    refreshLog();
  }, []);

  const refreshLog = async () => {
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/caregiver/log`);
      const j = await res.json();
      setLog(j);
    } catch { /* noop */ }
  };

  const save = async () => {
    if (!profile) return;

    // Validate phone number
    if (!phone || phone.trim().length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setSaving(true);
    try {
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: profile.nickname,
          gender: profile.gender,
          year_of_birth: profile.year_of_birth,
          routine_wake: profile.routine_wake,
          routine_breakfast: profile.routine_breakfast,
          routine_lunch: profile.routine_lunch,
          routine_dinner: profile.routine_dinner,
          routine_sleep: profile.routine_sleep,
          caregiver_phone: phone.trim(),
        }),
      });
      Alert.alert("Success", "Caregiver phone number saved successfully");
    } catch (e) {
      Alert.alert("Error", "Could not save phone number");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!phone || phone.trim().length < 10) {
      Alert.alert("Error", "Please save a valid phone number first");
      return;
    }

    setTesting(true);
    try {
      const r = await api.caregiverAlert("This is a test alert from PillCare.");
      Alert.alert("Test Sent", `Alert sent via ${r.delivered_via}${r.phone ? ` to ${r.phone}` : ""}`);
      refreshLog();
    } catch (e) {
      Alert.alert("Error", "Could not send test alert");
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-caregiver">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Caregiver & Family</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.infoCard}>
          <View style={styles.whatsappRow}>
            <View style={styles.whatsappIcon}>
              <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.cardTitle}>Connect via WhatsApp</Text>
              <Text style={styles.cardSub}>Alerts go to +{phone || "9804050031"}</Text>
            </View>
          </View>

          {phone && phone.trim().length >= 10 && (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
        </Card>

        <Text style={styles.label}>Caregiver WhatsApp Number *</Text>
        <TextInput
          testID="caregiver-phone-input"
          value={phone}
          onChangeText={setPhone}
          placeholder="+919804050031"
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Text style={styles.helper}>Enter with country code (e.g., +91 for India)</Text>

        <PrimaryButton
          label={saving ? "Saving..." : "Save Caregiver Number"}
          onPress={save}
          loading={saving}
          testID="save-caregiver-btn"
          style={{ marginTop: 16 }}
        />

        <PrimaryButton
          label={testing ? "Sending..." : "Send Test Alert"}
          variant="secondary"
          onPress={sendTest}
          loading={testing}
          testID="send-test-alert-btn"
          style={{ marginTop: 12 }}
        />

        <Card style={styles.noticeCard}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Ionicons name="information-circle" size={22} color={theme.colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>What gets shared?</Text>
              <Text style={styles.noticeText}>
                • When you skip a medication{"\n"}
                • When medication stock is running low{"\n"}
                • Emergency health alerts (if enabled)
              </Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        {log.length === 0 && (
          <Card>
            <Text style={styles.empty}>No alerts sent yet.</Text>
          </Card>
        )}
        {log.slice(0, 10).map((l) => (
          <Card key={l.id} style={{ marginBottom: 12 }}>
            <Text style={styles.alertMessage}>{l.message}</Text>
            <View style={styles.alertMeta}>
              <Text style={styles.alertTime}>
                {new Date(l.sent_at).toLocaleString()}
              </Text>
              <View style={styles.deliveryBadge}>
                <Text style={styles.deliveryText}>{l.delivered_via}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  title: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 40 },
  infoCard: {
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: 24,
  },
  whatsappRow: { flexDirection: "row", alignItems: "center" },
  whatsappIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#25D36620",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700"
  },
  cardSub: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.success + "20",
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  connectedText: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 12,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
    minHeight: 56,
  },
  helper: {
    color: theme.colors.textDisabled,
    fontSize: 12,
    marginTop: 6,
  },
  noticeCard: {
    backgroundColor: theme.colors.info + "10",
    borderColor: theme.colors.info + "30",
    marginTop: 24,
    marginBottom: 24,
  },
  noticeTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  empty: {
    color: theme.colors.textSecondary,
    padding: 8,
    textAlign: "center",
  },
  alertMessage: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  alertMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  alertTime: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  deliveryBadge: {
    backgroundColor: theme.colors.brandMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deliveryText: {
    color: theme.colors.brand,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
