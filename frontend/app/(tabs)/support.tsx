import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/lib/theme";
import { Card } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

type Row = { icon: string; title: string; sub: string; route: string; testID: string };

const ROWS: Row[] = [
  { icon: "scan-outline", title: "AI Medication Scanner", sub: "Snap a pill or packaging — we'll identify it.", route: "/scanner", testID: "row-scanner" },
  { icon: "search-outline", title: "Brand → Generic", sub: "Find the generic name for any brand.", route: "/brand-generic", testID: "row-resolver" },
  { icon: "people-outline", title: "Caregiver", sub: "Get a trusted person notified when needed.", route: "/caregiver", testID: "row-caregiver" },
  { icon: "time-outline", title: "Lifetime history", sub: "Export everything as CSV.", route: "/history", testID: "row-history" },
  { icon: "lock-closed-outline", title: "Privacy & encryption", sub: "What we collect, what we don't.", route: "/privacy", testID: "row-privacy" },
];

export default function Support() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.sub}>Tools, transparency, and people who care.</Text>

        {ROWS.map((r) => (
          <TouchableOpacity key={r.title} testID={r.testID} onPress={() => router.push(r.route as any)} activeOpacity={0.85}>
            <Card style={{ marginBottom: 12 }}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={r.icon as any} size={22} color={theme.colors.brand} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowSub}>{r.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <Text style={styles.faqH}>FAQ</Text>
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.faqQ}>Why do reminders need a built app?</Text>
          <Text style={styles.faqA}>Background scheduled notifications can&apos;t fire reliably inside Expo Go. Once you publish your build, every dose reminder is local and offline-capable.</Text>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.faqQ}>What happens if I skip a dose?</Text>
          <Text style={styles.faqA}>If you set up a caregiver, they&apos;ll get a friendly heads-up. You can turn this off any time.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: 16, paddingBottom: 120 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 8 },
  sub: { color: theme.colors.textSecondary, marginTop: 4, marginBottom: 16, paddingHorizontal: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandMuted, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: theme.colors.textPrimary, fontWeight: "700", fontSize: 16 },
  rowSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  faqH: { color: theme.colors.textPrimary, fontWeight: "700", fontSize: 18, marginTop: 20, marginBottom: 12, paddingHorizontal: 8 },
  faqQ: { color: theme.colors.textPrimary, fontWeight: "700" },
  faqA: { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 20 },
});
