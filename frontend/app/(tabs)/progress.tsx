import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme } from "@/src/lib/theme";
import { Card } from "@/src/components/PrimaryButton";
import { SimpleBarChart, SimpleLineChart } from "@/src/components/Charts";
import { api } from "@/src/lib/api";

export default function Progress() {
  const [data, setData] = useState<any | null>(null);
  const [bpSeries, setBpSeries] = useState<{ values: number[]; labels: string[] }>({ values: [], labels: [] });
  const [glucoseSeries, setGlucoseSeries] = useState<{ values: number[]; labels: string[] }>({ values: [], labels: [] });

  const load = useCallback(async () => {
    try {
      const adh = await api.adherence(7);
      setData(adh);
      const bp = await api.listMeasurements("blood_pressure");
      const sortedBp = bp.slice().reverse().slice(-10);
      setBpSeries({
        values: sortedBp.map((m: any) => m.value),
        labels: sortedBp.map((m: any) => new Date(m.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      });
      const gl = await api.listMeasurements("blood_glucose");
      const sortedGl = gl.slice().reverse().slice(-10);
      setGlucoseSeries({
        values: sortedGl.map((m: any) => m.value),
        labels: sortedGl.map((m: any) => new Date(m.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      });
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openHealthConnect = async () => {
    if (Platform.OS === "android") {
      try {
        await Linking.openURL("market://details?id=com.google.android.apps.healthdata");
      } catch {
        Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata");
      }
    } else if (Platform.OS === "ios") {
      Linking.openURL("x-apple-health://");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.sub}>Your health journey, at a glance.</Text>

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

        <Text style={styles.h2}>Blood Pressure trend</Text>
        <Card>
          {bpSeries.values.length === 0 ? (
            <Text style={styles.empty}>Log BP measurements to see trends here.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SimpleLineChart values={bpSeries.values} labels={bpSeries.labels} testID="bp-chart" />
            </ScrollView>
          )}
        </Card>

        <Text style={styles.h2}>Blood Glucose trend</Text>
        <Card>
          {glucoseSeries.values.length === 0 ? (
            <Text style={styles.empty}>Log glucose measurements to see trends here.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SimpleLineChart values={glucoseSeries.values} labels={glucoseSeries.labels} testID="glucose-chart" />
            </ScrollView>
          )}
        </Card>

        <Card style={styles.hcCard} testID="health-connect-card">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="fitness" size={28} color={theme.colors.info} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.hcTitle}>Connect Health Connect</Text>
              <Text style={styles.hcSub}>Sync steps, heart rate and sleep from your phone&apos;s health app.</Text>
            </View>
          </View>
          <TouchableOpacity testID="health-connect-btn" onPress={openHealthConnect} style={styles.hcBtn}>
            <Text style={styles.hcBtnText}>{Platform.OS === "android" ? "Open Health Connect" : Platform.OS === "ios" ? "Open Apple Health" : "Available on device builds"}</Text>
          </TouchableOpacity>
          <Text style={styles.hcNote}>Full read/write integration ships in your native build.</Text>
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
  h2: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 8, paddingHorizontal: 8 },
  streakCard: { marginTop: 8, backgroundColor: theme.colors.surfaceElevated },
  streakRow: { flexDirection: "row", alignItems: "center" },
  streakNum: { color: theme.colors.textPrimary, fontSize: 32, fontWeight: "700" },
  streakLabel: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  avgNum: { color: theme.colors.brand, fontSize: 28, fontWeight: "700", textAlign: "right" },
  avgLabel: { color: theme.colors.textSecondary, fontSize: 11, textAlign: "right" },
  empty: { color: theme.colors.textSecondary, padding: 12, textAlign: "center" },
  hcCard: { marginTop: 20, backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.info + "55" },
  hcTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  hcSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  hcBtn: { marginTop: 16, backgroundColor: theme.colors.info + "33", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  hcBtnText: { color: theme.colors.info, fontWeight: "700" },
  hcNote: { color: theme.colors.textDisabled, fontSize: 11, marginTop: 8, textAlign: "center" },
});
