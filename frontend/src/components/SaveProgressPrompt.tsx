import { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signInWithGoogle, getStoredUser, isGuestUser } from "@/src/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackEvent } from "@/src/lib/analytics";

const SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", BD = "rgba(233,233,237,0.1)";

const DISMISS_KEY = "pc_save_progress_dismissed_ts";

type Props = {
  visible: boolean;
  onClose: () => void;
  triggerReason?: string;
  onSuccess?: () => void;
};

export function SaveProgressPrompt({ visible, onClose, triggerReason = "Save your streak & progress", onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      trackEvent("save_progress_prompt_shown", { reason: triggerReason }).catch(() => {});
    }
  }, [visible]);

  const handleGoogleLink = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      trackEvent("account_linked", { method: "google" }).catch(() => {});
      Alert.alert("Account Linked!", "Your PillCare progress has been saved securely to your Google account.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      if (!err?.message?.includes("cancelled")) {
        Alert.alert("Account Link Failed", err?.message || "Could not link account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
      trackEvent("save_progress_prompt_dismissed", { reason: triggerReason }).catch(() => {});
    } catch {}
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleDismiss}>
        <View style={s.box}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={TM} />
            </TouchableOpacity>
          </View>

          <View style={s.iconWrap}>
            <Ionicons name="cloud-upload" size={28} color={AC} />
          </View>

          <Text style={s.title}>Protect your health data</Text>
          <Text style={s.feature}>{triggerReason}</Text>
          <Text style={s.desc}>
            Link your Google account to sync your dosage streak, health logs, and caregiver alerts safely across all your devices.
          </Text>

          <View style={s.perks}>
            {[
              "Sync medication history across phone & tablet",
              "Enable real-time caregiver SMS & WhatsApp alerts",
              "Never lose your health streak when updating app",
            ].map(p => (
              <View key={p} style={s.perkRow}>
                <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                <Text style={s.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.googleBtn, loading && { opacity: 0.7 }]}
            onPress={handleGoogleLink}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Save progress with Google Sign-In"
            testID="save-progress-google-btn"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#fff" />
                <Text style={s.googleBtnTx}>Save Progress with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.closeBtn} onPress={handleDismiss}>
            <Text style={s.closeTx}>Keep using as Guest</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export async function shouldShowSaveProgressPrompt(): Promise<boolean> {
  const user = await getStoredUser();
  if (!isGuestUser(user)) return false;
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      const elapsed = Date.now() - ts;
      if (elapsed < 24 * 60 * 60 * 1000) return false;
    }
  } catch {}
  return true;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 16 },
  box: { backgroundColor: SF, borderRadius: 20, padding: 20, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: BD },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(145,132,217,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12, alignSelf: "center" },
  title: { fontSize: 11, fontWeight: "700", color: AC, textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 4 },
  feature: { fontSize: 18, fontWeight: "700", color: TX, textAlign: "center", marginBottom: 6 },
  desc: { fontSize: 13, color: TM, textAlign: "center", lineHeight: 18, marginBottom: 16 },
  perks: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BD, marginBottom: 16, gap: 8 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkText: { fontSize: 12, color: TX, flex: 1, lineHeight: 16 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#6366F1", borderRadius: 12, minHeight: 48, paddingHorizontal: 16, marginBottom: 8 },
  googleBtnTx: { color: "#fff", fontWeight: "700", fontSize: 15 },
  closeBtn: { alignItems: "center", paddingVertical: 10 },
  closeTx: { fontSize: 13, color: TM },
});
