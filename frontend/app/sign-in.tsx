import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/lib/theme";
import { useGoogleAuthRequest, completeGoogleSignIn } from "@/src/lib/auth";

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
      <View style={styles.center}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>PillCare Reminder</Text>
        <Text style={styles.sub}>Never miss a dose again.</Text>
      </View>

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
        <Text style={styles.footNote}>
          Your data stays private to your account.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo: { width: 96, height: 96, marginBottom: 20 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  sub: { color: theme.colors.textSecondary, fontSize: 16, marginTop: 8, textAlign: "center" },
  footer: { padding: 24, paddingBottom: 32, alignItems: "center" },
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
  footNote: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 16, textAlign: "center" },
});
