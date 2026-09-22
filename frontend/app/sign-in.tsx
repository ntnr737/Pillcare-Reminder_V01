import { useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithGoogle } from "@/src/lib/auth";

const BG = "#0B0D14", SF = "#161926", TX = "#F9FAFB",
  TM = "rgba(249, 250, 251, 0.65)", AC = "#6366F1", A3 = "#818CF8",
  AB = "rgba(99, 102, 241, 0.14)", BD = "rgba(255, 255, 255, 0.08)";

const FEATURES = [
  { icon: "notifications-outline", title: "Smart Reminders", body: "Never miss a dose" },
  { icon: "people-outline", title: "Family Alerts", body: "WhatsApp alerts to caregivers" },
  { icon: "search-outline", title: "Brand to Generic", body: "Find affordable alternatives" },
  { icon: "bar-chart-outline", title: "Health Insights", body: "AI-powered weekly reports" },
  { icon: "body-outline", title: "Yoga & Wellness", body: "Personalized yoga routines" },
  { icon: "calendar-outline", title: "Refill Reminders", body: "Never run out of medication" },
] as const;

const BADGES = [
  { icon: "lock-closed-outline", label: "End-to-End\nEncrypted" },
] as const;

export default function SignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign-In Failed", e?.message || "Could not sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // NO ScrollView — fixed layout fills screen exactly
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>

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
          Your <Text style={{ color: A3 }}>AI</Text> health companion for medication reminders,{" "}
          <Text style={{ color: A3 }}>yoga</Text> and family care.
        </Text>
      </View>

      {/* Feature grid 2x3 */}
      <View style={s.grid}>
        {FEATURES.map(f => (
          <View key={f.title} style={s.feCard}>
            <View style={s.feIco}>
              <Ionicons name={f.icon as any} size={13} color={A3} />
            </View>
            <Text style={s.feTitle}>{f.title}</Text>
            <Text style={s.feBody}>{f.body}</Text>
          </View>
        ))}
      </View>

      {/* AI stat card */}
      <View style={s.statCard}>
        <View style={s.statIco}><Ionicons name="sparkles" size={13} color={A3} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.statMain}>
            Reduce missed medications by <Text style={{ color: A3, fontWeight: "700" }}>up to 90%</Text>
          </Text>
          <Text style={s.statSub}>Stay on track. Stay healthy.</Text>
        </View>
      </View>

      {/* Avatar row */}
      <View style={s.avatarRow}>
        <View style={s.avatars}>
          {[["MK", "#64748b"], ["SR", AC], ["AN", "#7c6f9a"]].map(([initials, bg], i) => (
            <View key={initials} style={[s.avatar, { backgroundColor: bg, marginLeft: i > 0 ? -8 : 0 }]}>
              <Text style={s.avatarTx}>{initials}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 1 }}>
          {[1, 2, 3, 4, 5].map(i => <Ionicons key={i} name="star" size={11} color={A3} />)}
        </View>
        <View>
          <Text style={s.trustMain}>Trusted by 10,000+ users</Text>
          <Text style={s.trustSub}>Patients, caregivers & families</Text>
        </View>
      </View>

      {/* Google Sign-In button */}
      <TouchableOpacity style={[s.gBtn, loading && { opacity: 0.7 }]} onPress={handleSignIn} disabled={loading}>
        <Ionicons name="logo-google" size={16} color="#fff" />
        <Text style={s.gBtnTx}>{loading ? "Signing in…" : "Continue with Google"}</Text>
      </TouchableOpacity>

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
        <Ionicons name="lock-closed-outline" size={10} color={TM} />
        <Text style={s.footTx}>Your data is safe and secure with us.</Text>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 6, paddingBottom: 8,
    // flex layout distributes space evenly — no scrolling
    justifyContent: "space-between",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  // Use the actual high-quality app icon, clipped to a rounded square
  logoImg: { width: 32, height: 32, borderRadius: 8, overflow: "hidden" },
  logoName: { fontSize: 17, fontWeight: "700", color: TX, letterSpacing: -.3 },
  headlineBlock: { gap: 5 },
  h1: { fontSize: 24, fontWeight: "700", color: TX, lineHeight: 30, letterSpacing: -.5 },
  sub: { fontSize: 12, color: TM, lineHeight: 17 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  feCard: { width: "48.5%", backgroundColor: SF, borderRadius: 11, padding: 10, gap: 4, borderWidth: 1, borderColor: BD },
  feIco: { width: 24, height: 24, borderRadius: 12, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  feTitle: { fontSize: 11, fontWeight: "700", color: TX },
  feBody: { fontSize: 10, color: TM, lineHeight: 13 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SF, borderRadius: 11, padding: 10, borderWidth: 1, borderColor: "rgba(145,132,217,0.3)" },
  statIco: { width: 26, height: 26, borderRadius: 13, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  statMain: { fontSize: 11, color: TX },
  statSub: { fontSize: 10, color: TM },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatars: { flexDirection: "row" },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: BG, alignItems: "center", justifyContent: "center" },
  avatarTx: { fontSize: 8, fontWeight: "700", color: "#fff" },
  trustMain: { fontSize: 11, color: TX, fontWeight: "600" },
  trustSub: { fontSize: 9, color: TM },
  gBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: AC, borderRadius: 12, height: 44 },
  gBtnTx: { color: "#fff", fontWeight: "700", fontSize: 14 },
  guestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: SF, borderRadius: 12, height: 42, borderWidth: 1, borderColor: BD },
  guestBtnTx: { color: TX, fontWeight: "600", fontSize: 13 },
  badges: { flexDirection: "row", justifyContent: "space-around" },
  badge: { alignItems: "center", gap: 4 },
  badgeTx: { fontSize: 9, color: TM, textAlign: "center", lineHeight: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  footTx: { fontSize: 10, color: TM },
});
