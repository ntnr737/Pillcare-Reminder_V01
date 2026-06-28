import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card } from "@/src/components/PrimaryButton";

export default function Privacy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-privacy">
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Encryption</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ alignItems: "center", padding: 24 }}>
          <View style={styles.shield}>
            <Ionicons name="shield-checkmark" size={48} color={theme.colors.brand} />
          </View>
          <Text style={styles.badge}>AES-256 at rest</Text>
          <Text style={styles.tagline}>Your health story is yours alone.</Text>
        </Card>

        <Text style={styles.h}>What we collect</Text>
        <Card style={{ marginTop: 8 }}>
          <Text style={styles.body1}>Your medications, doses, measurements, activities, and mood. That&apos;s it.</Text>
        </Card>

        <Text style={styles.h}>What we don&apos;t do</Text>
        <Card style={{ marginTop: 8 }}>
          <Text style={styles.bullet}>• No third-party trackers or ad SDKs</Text>
          <Text style={styles.bullet}>• No selling data — ever</Text>
          <Text style={styles.bullet}>• No background uploads to insurers or advertisers</Text>
        </Card>

        <Text style={styles.h}>How encryption works</Text>
        <Card style={{ marginTop: 8 }}>
          <Text style={styles.body1}>
            On your device, sensitive credentials are stored in iOS Keychain / Android EncryptedSharedPreferences (AES-256).
            Your medication and health log lives in our backend database, encrypted at rest by the cloud provider with AES-256.
            All traffic is over TLS 1.3.
          </Text>
        </Card>

        <Text style={styles.h}>Honest caveats</Text>
        <Card style={{ marginTop: 8, backgroundColor: theme.colors.surfaceElevated }}>
          <Text style={styles.body1}>
            We&apos;re not HIPAA-certified. If you live somewhere with strict health data laws, please consult your healthcare
            provider before storing sensitive conditions here. You can export everything and delete your account at any time.
          </Text>
        </Card>

        <Text style={styles.h}>Crash analytics</Text>
        <Card style={{ marginTop: 8 }}>
          <Text style={styles.body1}>
            We use Firebase Analytics (anonymous) to fix bugs and improve the app. No medication names or measurements are ever sent.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 32 },
  shield: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.brandMuted, alignItems: "center", justifyContent: "center" },
  badge: { color: theme.colors.brand, fontSize: 14, fontWeight: "700", marginTop: 16, letterSpacing: 1.5 },
  tagline: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 8, textAlign: "center" },
  h: { color: theme.colors.textPrimary, fontWeight: "700", fontSize: 18, marginTop: 24, marginBottom: 4, paddingHorizontal: 4 },
  body1: { color: theme.colors.textSecondary, lineHeight: 22 },
  bullet: { color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 },
});
