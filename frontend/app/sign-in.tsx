import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithGoogle, signInAsGuest } from "@/src/lib/auth";
import { trackEvent } from "@/src/lib/analytics";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_BASE_URL } from "@/src/lib/config";

const BG = "#0B0D14", SF = "#161926", TX = "#F9FAFB",
  TM = "rgba(249, 250, 251, 0.65)", AC = "#6366F1", A3 = "#818CF8",
  AB = "rgba(99, 102, 241, 0.14)", BD = "rgba(255, 255, 255, 0.08)";

const FEATURES = [
  { icon: "notifications-outline", title: "Smart Reminders", body: "Never miss a dose" },
  { icon: "people-outline", title: "Caregiver Alerts", body: "SMS and WhatsApp alerts" },
  { icon: "search-outline", title: "Brand to Generic", body: "Find affordable alternatives" },
  { icon: "bar-chart-outline", title: "Health Insights", body: "Weekly adherence reports" },
  { icon: "body-outline", title: "Yoga & Wellness", body: "Guided wellness routines" },
  { icon: "calendar-outline", title: "Refill Reminders", body: "Stock tracking & alerts" },
] as const;

const BADGES = [
  { icon: "lock-closed-outline", label: "Private & Secure\nEncrypted Storage" },
] as const;

export default function SignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const BASE = API_BASE_URL;
    if (!BASE || !BASE.startsWith("http")) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-App-Platform": Platform.OS,
      "X-App-Version": Constants.expoConfig?.version || "0.0.0",
    };
    try {
      fetch(`${BASE}/api/public/feature-config`, { headers })
        .then((res) => res.ok ? res.json() : null)
        .then((config) => {
          if (!config) return;
          setGoogleEnabled(config.google_login !== false);
          setMaintenanceMode(config.maintenance_mode === true);
        })
        .catch(() => {});
    } catch {}
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      trackEvent("sign_in_completed", { is_guest: false }).catch(() => {});
      router.replace("/");
    } catch (e: any) {
      if (e?.message?.includes("cancelled")) {
        setLoading(false);
        return;
      }
      Alert.alert("Google Sign-In", e?.message || "Could not complete Google Sign-In. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    try {
      await signInAsGuest();
      trackEvent("guest_session_started", { is_guest: true }).catch(() => {});
      router.push("/onboarding");
    } catch (e: any) {
      Alert.alert("Guest Access", e?.message || "Could not start guest session.");
    } finally {
      setLoading(false);
    }
  };

  if (maintenanceMode) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", padding: 28 }]}>
        <Text style={s.h1}>PillCare is temporarily unavailable</Text>
        <Text style={[s.sub, { textAlign: "center", marginTop: 8 }]}>We’re performing maintenance. Please try again shortly.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={s.logoRow}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={s.logoImg}
            resizeMode="cover"
          />
          <Text style={s.logoName}>PillCare</Text>
        </View>

        {/* Headline */}
        <View style={s.headlineBlock}>
          <Text style={s.h1}>
            {"Never Miss\n"}<Text style={{ color: A3 }}>{"Your Medicines\n"}</Text>{"Again"}
          </Text>
          <Text style={s.sub}>
            Your health companion for medication reminders,{" "}
            <Text style={{ color: A3 }}>wellness tracking</Text> and family care.
          </Text>
        </View>

        {/* Feature grid 2x3 */}
        <View style={s.grid}>
          {FEATURES.map(f => (
            <View key={f.title} style={s.feCard}>
              <View style={s.feIco}>
                <Ionicons name={f.icon as any} size={14} color={A3} />
              </View>
              <Text style={s.feTitle}>{f.title}</Text>
              <Text style={s.feBody}>{f.body}</Text>
            </View>
          ))}
        </View>

        {/* AI stat card */}
        <View style={s.statCard}>
          <View style={s.statIco}><Ionicons name="sparkles" size={14} color={A3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.statMain}>
              Organize schedules & track daily dosage adherence
            </Text>
            <Text style={s.statSub}>Stay on track. Stay healthy.</Text>
          </View>
        </View>

        {/* Sign-In options */}
        <View style={{ gap: 12, marginTop: 8 }}>
          {googleEnabled && <TouchableOpacity
            style={[s.gBtn, loading && { opacity: 0.7 }]}
            onPress={handleSignIn}
            disabled={loading}
            accessibilityLabel="Sign In with Google Account"
            accessibilityRole="button"
            testID="google-signin-btn"
          >
            <Ionicons name="logo-google" size={18} color="#fff" />
            <Text style={s.gBtnTx}>{loading ? "Signing in…" : "Sign In with Google Account"}</Text>
          </TouchableOpacity>}

          <TouchableOpacity
            style={[s.guestBtn, loading && { opacity: 0.7 }]}
            onPress={handleGuestSignIn}
            disabled={loading}
            accessibilityLabel="Continue as guest without creating an account"
            accessibilityRole="button"
            testID="guest-continue-btn"
          >
            <Ionicons name="person-outline" size={18} color={TX} />
            <Text style={s.guestBtnTx}>Continue without account</Text>
          </TouchableOpacity>
        </View>

        {/* Trust badges */}
        <View style={s.badges}>
          {BADGES.map(b => (
            <View key={b.label} style={s.badge}>
              <Ionicons name={b.icon as any} size={14} color={A3} />
              <Text style={s.badgeTx}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Ionicons name="lock-closed-outline" size={12} color={TM} />
          <Text style={s.footTx}>Your health data is safe and encrypted on your device.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoImg: { width: 36, height: 36, borderRadius: 10, overflow: "hidden" },
  logoName: { fontSize: 18, fontWeight: "700", color: TX, letterSpacing: -.3 },
  headlineBlock: { gap: 6 },
  h1: { fontSize: 26, fontWeight: "700", color: TX, lineHeight: 32, letterSpacing: -.5 },
  sub: { fontSize: 13, color: TM, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  feCard: { width: "48%", backgroundColor: SF, borderRadius: 12, padding: 12, gap: 5, borderWidth: 1, borderColor: BD },
  feIco: { width: 28, height: 28, borderRadius: 14, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  feTitle: { fontSize: 12, fontWeight: "700", color: TX },
  feBody: { fontSize: 11, color: TM, lineHeight: 14 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: SF, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(145,132,217,0.3)" },
  statIco: { width: 28, height: 28, borderRadius: 14, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  statMain: { fontSize: 12, color: TX, fontWeight: "500" },
  statSub: { fontSize: 11, color: TM },
  guestBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: SF, borderRadius: 12, minHeight: 48, borderWidth: 1, borderColor: BD, paddingHorizontal: 16
  },
  guestBtnTx: { fontSize: 14, fontWeight: "600", color: TX },
  gBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: AC, borderRadius: 12, minHeight: 48, paddingHorizontal: 16 },
  gBtnTx: { color: "#fff", fontWeight: "700", fontSize: 15 },
  badges: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  badge: { alignItems: "center", gap: 4 },
  badgeTx: { fontSize: 10, color: TM, textAlign: "center", lineHeight: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
  footTx: { fontSize: 11, color: TM },
});
