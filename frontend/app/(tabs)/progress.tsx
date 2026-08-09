import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme } from "@/src/lib/theme";
import { Card } from "@/src/components/PrimaryButton";
import { SimpleBarChart } from "@/src/components/Charts";
import { api } from "@/src/lib/api";

export default function Progress() {
  const [data, setData] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const adh = await api.adherence(7);
      setData(adh);
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.sub}>Your medication adherence journey.</Text>

        <Card style={styles.streakCard} testID="streak-card">
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={40} color={theme.colors.secondary} />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.streakNum}>{data?.streak ?? 0}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>
            <View>
              <Text style={styles.avgNum}>{data?.average ?? 0}%</Text>
              <Text style={styles.avgLabel}>7-day adherence</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.h2}>Last 7 days adherence</Text>
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <SimpleBarChart
              data={(data?.daily || []).map((d: any) => ({
                label: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
                value: d.pct,
              }))}
              testID="adherence-chart"
            />
          </ScrollView>
        </Card>

        <Text style={styles.note}>
          Track your health measurements and activities in the Treatment tab.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: 16, paddingBottom: 120 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 8 },
  sub: { color: theme.colors.textSecondary, marginTop: 4, marginBottom: 16, paddingHorizontal: 8 },
  h2: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 8, paddingHorizontal: 8 },
  streakCard: { marginTop: 8, backgroundColor: theme.colors.surfaceElevated },
  streakRow: { flexDirection: "row", alignItems: "center" },
  streakNum: { color: theme.colors.textPrimary, fontSize: 32, fontWeight: "700" },
  streakLabel: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  avgNum: { color: theme.colors.brand, fontSize: 28, fontWeight: "700", textAlign: "right" },
  avgLabel: { color: theme.colors.textSecondary, fontSize: 11, textAlign: "right" },
  note: { color: theme.colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
});
