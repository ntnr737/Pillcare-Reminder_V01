import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

export default function History() {
  const router = useRouter();

  const downloadCsv = async () => {
    const url = api.exportCsvUrl();
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-history">
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Lifetime history</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="archive-outline" size={28} color={theme.colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.h}>Export all data</Text>
              <Text style={styles.sub}>Doses, measurements, activities and mood as a single CSV file.</Text>
            </View>
          </View>
          <View style={{ height: 16 }} />
          <PrimaryButton label="Download CSV" onPress={downloadCsv} testID="export-csv-btn" />
        </Card>

        <Card style={{ marginTop: 16, backgroundColor: theme.colors.surfaceElevated }}>
          <Text style={styles.h}>What&apos;s included</Text>
          <Text style={styles.bullet}>• Every dose with its scheduled time and status</Text>
          <Text style={styles.bullet}>• Every measurement with value, unit and note</Text>
          <Text style={styles.bullet}>• Activities and sleep/water entries</Text>
          <Text style={styles.bullet}>• Mood entries with score and note</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  body: { padding: 16 },
  h: { color: theme.colors.textPrimary, fontWeight: "700", fontSize: 16 },
  sub: { color: theme.colors.textSecondary, marginTop: 4 },
  bullet: { color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 },
});
