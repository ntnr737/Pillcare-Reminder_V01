import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/lib/theme";
import { useGoogleAuthRequest, completeGoogleSignIn } from "@/src/lib/auth";

const FEATURES = [
  {
    icon: "time-outline",
    title: "Precise time tracking",
    body: "Scheduled reminders that respect your daily routine.",
  },
  {
    icon: "people-outline",
    title: "Caregiver updates",
    body: "A trusted person can get a daily WhatsApp summary.",
  },
  {
    icon: "sparkles-outline",
    title: "AI-assisted lookup",
    body: "Identify medications by photo or brand name.",
  },
];

export default function SignIn() {
  const router = useRouter();
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      setLoading(true);
      completeGoogleSignIn(response)
        .then(() => router.replace("/"))
        .catch((e: any) => {
          Alert.alert("Sign-in failed", e?.message || "Something went wrong. Please try again.");
        })
        .finally(() => setLoading(false));
    } else if (response.type === "error") {
      Alert.alert("Sign-in failed", "Google sign-in could not complete. Please try again.");
    }
  }, [response, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>PillCare Reminder</Text>
        </View>

        <Text style={styles.tagline}>
          Never miss a <Text style={styles.taglineEmphasis}>dose</Text> again.
        </Text>
        <Text style={styles.sub}>
          A calmer way to stay on top of your medications, one reminder at a time.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={20} color={theme.colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="google-signin-btn"
          style={styles.googleBtn}
          activeOpacity={0.85}
          disabled={!request || loading}
          onPress={() => promptAsync()}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.bg} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={theme.colors.bg} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.footNote}>Your data stays private to your account.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  header: { alignItems: "center", marginBottom: 28 },
  logo: { width: 84, height: 84, marginBottom: 12 },
  appName: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  tagline: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: "700", letterSpacing: -0.5, lineHeight: 36 },
  taglineEmphasis: { color: theme.colors.brand, fontStyle: "italic" },
  sub: { color: theme.colors.textSecondary, fontSize: 16, marginTop: 10, marginBottom: 28, lineHeight: 22 },
  features: { gap: 12 },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 16,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" },
  featureBody: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, alignItems: "center" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.brand,
    borderRadius: 28,
    height: 56,
    width: "100%",
  },
  googleBtnText: { color: theme.colors.bg, fontWeight: "700", fontSize: 16 },
  footNote: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 14, textAlign: "center" },
});
