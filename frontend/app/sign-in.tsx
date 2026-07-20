import { useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithGoogle } from "@/src/lib/auth";

const BG = "#161826";
const SURFACE = "#232532";
const TEXT = "#e9e9ed";
const TEXT_MUTED = "rgba(233,233,237,0.6)";
const ACCENT = "#9184d9";
const ACCENT_LIGHT = "#a7a1db";
const ACCENT_BG = "rgba(145,132,217,0.16)";
const ACCENT_BORDER = "rgba(145,132,217,0.28)";

const FEATURES = [
  { icon: "notifications-outline", title: "Smart Reminders", body: "Never miss a dose with timely alerts" },
  { icon: "people-outline", title: "Family Alerts", body: "Instant WhatsApp alerts to loved ones" },
  { icon: "search-outline", title: "Brand to Generic", body: "Find affordable generic alternatives" },
  { icon: "bar-chart-outline", title: "Health Insights", body: "Track progress with AI-powered reports" },
  { icon: "body-outline", title: "Yoga & Wellness", body: "Personalized wellness recommendations" },
  { icon: "calendar-check-outline", title: "Refill Reminders", body: "Never run out, get alerts on time" },
] as const;

const BADGES = [
  { icon: "shield-checkmark-outline", label: "End-to-End\nEncrypted" },
  { icon: "lock-closed-outline", label: "Private to\nYour Account" },
  { icon: "cloud-outline", label: "Secure Cloud\nStorage" },
] as const;

const AVATARS = [
  { initials: "MK", bg: "#4a5568" },
  { initials: "SR", bg: "#553c9a" },
  { initials: "AN", bg: "#2d6a4f" },
];

export default function SignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Logo row */}
        <View style={s.logoRow}>
          <View style={s.logoIcon}>
            <Image source={require("@/assets/images/logo-mark.png")} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </View>
          <Text style={s.logoName}>PillCare</Text>
        </View>

        {/* Headline */}
        <View>
          <Text style={s.headline}>
            {"Never Miss\n"}<Text style={s.headlineAccent}>{"Your Medicines\n"}</Text>{"Again"}
          </Text>
          <Text style={s.sub}>
            {"Your "}<Text style={s.subAccent}>AI</Text>{" health companion for medication reminders, family care and better health."}
          </Text>
        </View>

        {/* Feature grid */}
        <View style={s.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={s.featureCard}>
              <View style={s.featureIconWrap}>
                <Ionicons name={f.icon as any} size={16} color={ACCENT_LIGHT} />
              </View>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureBody}>{f.body}</Text>
            </View>
          ))}
        </View>

        {/* Stat card */}
        <View style={s.statCard}>
          <View style={s.statIconWrap}>
            <Ionicons name="sparkles-outline" size={16} color={ACCENT_LIGHT} />
          </View>
          <View>
            <Text style={s.statText}>
              {"Reduce missed medications by "}
              <Text style={s.statAccent}>up to 90%</Text>
            </Text>
            <Text style={s.statSub}>Stay on track. Stay healthy.</Text>
          </View>
        </View>

        {/* Trusted row */}
        <View style={s.trustedRow}>
          <View style={s.avatars}>
            {AVATARS.map((a, i) => (
              <View key={a.initials} style={[s.avatar, { backgroundColor: a.bg, marginLeft: i === 0 ? 0 : -8 }]}>
                <Text style={s.avatarText}>{a.initials}</Text>
              </View>
            ))}
          </View>
          <View style={s.starsRow}>
            {[0,1,2,3,4].map(i => <Text key={i} style={s.star}>★</Text>)}
          </View>
          <View>
            <Text style={s.trustedTitle}>Trusted by 10,000+ users</Text>
            <Text style={s.trustedSub}>Patients, caregivers &amp; families</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          testID="google-signin-btn"
          style={s.googleBtn}
          activeOpacity={0.85}
          disabled={loading}
          onPress={handleSignIn}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={s.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Trust badges */}
        <View style={s.badgesRow}>
          {BADGES.map((b) => (
            <View key={b.label} style={s.badge}>
              <Ionicons name={b.icon as any} size={18} color={ACCENT_LIGHT} />
              <Text style={s.badgeLabel}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Fine print */}
        <View style={s.finePrint}>
          <Text style={s.fineText}>
            <Ionicons name="lock-closed-outline" size={10} color="rgba(233,233,237,0.45)" /> Your data is safe and secure with us.
          </Text>
          <Text style={s.fineText}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  body: { padding: 24, paddingBottom: 40, gap: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" },
  logoName: { fontSize: 19, fontWeight: "700", color: TEXT, letterSpacing: -0.3 },
  headline: { fontSize: 32, fontWeight: "700", color: TEXT, lineHeight: 38, letterSpacing: -0.5 },
  headlineAccent: { color: ACCENT_LIGHT },
  sub: { fontSize: 13, color: TEXT_MUTED, lineHeight: 20, marginTop: 10 },
  subAccent: { color: ACCENT_LIGHT },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: { width: "47.5%", backgroundColor: SURFACE, borderRadius: 14, padding: 14, gap: 8 },
  featureIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 13, fontWeight: "700", color: TEXT },
  featureBody: { fontSize: 11, color: TEXT_MUTED, lineHeight: 16 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: SURFACE, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: ACCENT_BORDER },
  statIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" },
  statText: { fontSize: 13, color: TEXT },
  statAccent: { color: ACCENT_LIGHT, fontWeight: "700" },
  statSub: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  trustedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatars: { flexDirection: "row" },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: BG, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  starsRow: { flexDirection: "row", gap: 1 },
  star: { fontSize: 13, color: ACCENT_LIGHT },
  trustedTitle: { fontSize: 12, color: TEXT },
  trustedSub: { fontSize: 10, color: TEXT_MUTED },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ACCENT, borderRadius: 14, height: 50 },
  googleBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
  badgesRow: { flexDirection: "row", justifyContent: "space-between" },
  badge: { flex: 1, alignItems: "center", gap: 5 },
  badgeLabel: { fontSize: 10, color: TEXT_MUTED, textAlign: "center", lineHeight: 14 },
  finePrint: { gap: 4, alignItems: "center" },
  fineText: { fontSize: 10, color: "rgba(233,233,237,0.45)", textAlign: "center", lineHeight: 16 },
});
