import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { getFeatures } from "@/src/lib/features";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { get, set, K } from "@/src/lib/store";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", BD = "rgba(233,233,237,0.1)";

export default function History() {
  const router = useRouter();
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Show cached data immediately
      const cached = await get<any[]>(K.history);
      if (cached?.length) { setDays(cached); setLoading(false); }

      const historyDays = getFeatures().history_days;
      const data = await api.doseHistory(historyDays);
      const list = (data || []).filter((d: any) => d.entries?.length > 0);
      setDays(list);
      await set(K.history, list);
    } catch {
      // Offline — cached already shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const downloadCsv = () => {
    if (!getFeatures().export_data) { setShowUpgrade(true); return; }
    Linking.openURL(api.exportCsvUrl());
  };

  const statusColor = (s: string) =>
    s === "taken" || s === "yoga_completed" || s === "yoga_practice" || s === "completed"
      ? "#4ade80"
      : s === "missed" || s === "skipped"
      ? "#f87171"
      : "#fbbf24";
  const statusIcon = (s: string) =>
    s === "taken"
      ? "checkmark-circle"
      : s === "yoga_completed" || s === "yoga_practice"
      ? "fitness"
      : s === "completed"
      ? "checkmark-circle"
      : "close-circle";
  const statusLabel = (s: string) =>
    s === "taken"
      ? "Taken"
      : s === "yoga_completed" || s === "yoga_practice" || s === "completed"
      ? "Completed"
      : s === "missed"
      ? "Missed"
      : "Skipped";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/today");
            }
          }}
        >
          <Ionicons name="arrow-back" size={20} color={TX} />
        </TouchableOpacity>
        <Text style={s.title}>Activity & Dose Log</Text>
        <TouchableOpacity style={s.exportBtn} onPress={downloadCsv}>
          <Ionicons name="download-outline" size={14} color={AC} />
          <Text style={s.exportTx}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {loading && !days.length ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={AC} size="large" />
          <Text style={{ color: TM, fontSize: 13 }}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={AC} />}
          showsVerticalScrollIndicator={false}
        >
          {!days.length ? (
            <View style={{ alignItems: "center", padding: 48, gap: 12 }}>
              <Ionicons name="calendar-outline" size={40} color={TM} />
              <Text style={{ color: TM, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
                No history yet.{"\n"}Start marking doses as taken or completing yoga sessions.
              </Text>
            </View>
          ) : days.map((day: any) => {
            const dateStr = new Date(day.date + "T12:00:00").toLocaleDateString("en-IN", {
              weekday: "short", day: "numeric", month: "short"
            });
            const adh = day.total > 0 ? Math.round(day.taken / day.total * 100) : 0;
            return (
              <View key={day.date} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={s.dateLabel}>{dateStr}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 11, color: adh >= 80 ? "#4ade80" : adh >= 50 ? "#fbbf24" : "#f87171" }}>
                      {adh}% taken
                    </Text>
                    <Text style={{ fontSize: 10, color: TM }}>({day.taken}/{day.total})</Text>
                  </View>
                </View>
                {(day.entries || []).map((entry: any, i: number) => (
                  <View key={i} style={s.row}>
                    <Ionicons name={statusIcon(entry.status) as any} size={18} color={statusColor(entry.status)} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.medName}>{entry.name}</Text>
                      <Text style={s.time}>
                        {entry.time}
                        {entry.dosage ? ` · ${entry.dosage} ${entry.unit || ""}`.trim() : ""}
                        {entry.note && !entry.note.includes(entry.dosage) ? ` · ${entry.note}` : ""}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: statusColor(entry.status) + "20" }]}>
                      <Text style={[s.badgeTx, { color: statusColor(entry.status) }]}>
                        {statusLabel(entry.status)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Extended history & CSV export"
        description="Free plan shows 7-day history. Pro Dharma unlocks 90-day history and CSV export."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: BD, gap: 12 },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: TX },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(145,132,217,0.1)", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  exportTx: { fontSize: 12, fontWeight: "700", color: AC },
  dateLabel: { fontSize: 11, fontWeight: "700", color: TM, textTransform: "uppercase", letterSpacing: 0.06 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SF, borderRadius: 10, padding: 12, marginBottom: 5, borderWidth: 1, borderColor: BD },
  medName: { fontSize: 14, fontWeight: "600", color: TX },
  time: { fontSize: 11, color: TM, marginTop: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTx: { fontSize: 11, fontWeight: "700" },
});
