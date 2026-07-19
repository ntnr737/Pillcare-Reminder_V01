import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/lib/theme";
import { WeekStrip } from "@/src/components/WeekStrip";
import { Card } from "@/src/components/PrimaryButton";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { api } from "@/src/lib/api";
import { resyncReminders } from "@/src/lib/notifications";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_META: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: "ellipse-outline", color: theme.colors.textSecondary, label: "Pending" },
  taken: { icon: "checkmark-circle", color: theme.colors.success, label: "Taken" },
  skipped: { icon: "close-circle", color: theme.colors.error, label: "Skipped" },
  missed: { icon: "alert-circle", color: theme.colors.warning, label: "Missed" },
};

export default function Today() {
  const [date, setDate] = useState(todayStr());
  const [doses, setDoses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [sheet, setSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [aiMsg, setAiMsg] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.listDoses(date), api.getProfile()]);
      setDoses(d);
      setProfile(p);
    } catch (e) {
      console.warn(e);
    }
  }, [date]);

  const loadAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const r = await api.dailyMessage();
      setAiMsg(r.message);
      setStreak(r.streak);
    } catch {
      setAiMsg("");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); loadAi(); }, [load, loadAi]));
  useEffect(() => { load(); }, [load]);

  const onPullRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadAi()]);
    setRefreshing(false);
  };

  const setStatus = async (id: string, status: string, med?: any) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await api.setDoseStatus(id, status);
      if (status === "skipped" && med?.name) {
        api.caregiverAlert(`${profile?.nickname || "User"} skipped ${med.name}`, med.name).catch(() => {});
      }
      // Refill alert
      if (status === "taken" && med && (med.stock - 1) <= med.refill_threshold) {
        api.caregiverAlert(`${med.name} is running low (${med.stock - 1} left)`, med.name).catch(() => {});
      }
      load();
      loadAi();
    } catch (e) { console.warn(e); }
  };

  const total = doses.length;
  const taken = doses.filter((d) => d.status === "taken").length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.colors.brand} />}
      >
        <View style={styles.header}>
          <View style={styles.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greet}>{greeting}{profile?.nickname ? `, ${profile.nickname}` : ""}</Text>
              <Text style={styles.sub}>
                {total === 0 ? "No doses scheduled — add a medication to begin." : `${taken} of ${total} taken today`}
              </Text>
            </View>
            <View style={styles.streakChip} testID="today-streak-chip">
              <Ionicons name="flame" size={18} color={theme.colors.secondary} />
              <Text style={styles.streakNum}>{streak}</Text>
              <Text style={styles.streakWord}>day{streak === 1 ? "" : "s"}</Text>
            </View>
          </View>

          {(aiMsg || aiLoading) && (
            <View style={styles.aiCard} testID="ai-daily-card">
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color={theme.colors.brand} />
                <Text style={styles.aiBadgeText}>From PillCare</Text>
              </View>
              {aiLoading && !aiMsg ? (
                <Text style={styles.aiMsg}>…</Text>
              ) : (
                <Text style={styles.aiMsg}>{aiMsg}</Text>
              )}
            </View>
          )}
        </View>

        <View style={{ backgroundColor: theme.colors.bg }}>
          <WeekStrip selected={date} onSelect={setDate} />
        </View>

        <View style={styles.list}>
          {doses.length === 0 && (
            <Card testID="empty-doses">
              <Text style={styles.emptyTitle}>No doses for this day</Text>
              <Text style={styles.emptySub}>Tap + to add your first medication.</Text>
            </Card>
          )}
          {doses.map((d) => {
            const meta = STATUS_META[d.status] || STATUS_META.pending;
            const med = d.medication || {};
            return (
              <Card key={d.id} testID={`dose-${d.id}`} style={{ marginBottom: 12 }}>
                <View style={styles.doseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{med.name}</Text>
                    {!!med.generic_name && <Text style={styles.generic}>{med.generic_name}</Text>}
                    <Text style={styles.dosage}>
                      {med.dosage} {med.unit} • {d.scheduled_time}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Ionicons name={meta.icon as any} size={28} color={meta.color} />
                    <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity testID={`taken-${d.id}`} onPress={() => setStatus(d.id, "taken", med)} style={[styles.actionBtn, styles.takenBtn]}>
                    <Ionicons name="checkmark" size={18} color={theme.colors.textInverse} />
                    <Text style={styles.takenText}>Taken</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`skip-${d.id}`} onPress={() => setStatus(d.id, "skipped", med)} style={[styles.actionBtn, styles.skipBtn]}>
                    <Ionicons name="close" size={18} color={theme.colors.error} />
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                </View>
                {med.stock !== undefined && med.stock <= med.refill_threshold && (
                  <View style={styles.refillTag}>
                    <Ionicons name="warning-outline" size={14} color={theme.colors.warning} />
                    <Text style={styles.refillText}>Low stock: {med.stock} left</Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <TouchableOpacity testID="add-med-fab" style={styles.fab} onPress={() => setSheet(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={theme.colors.textInverse} />
        <Text style={styles.fabText}>Add</Text>
      </TouchableOpacity>

      <AddMedicationSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onSaved={() => { load(); resyncReminders().catch(() => {}); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  greetRow: { flexDirection: "row", alignItems: "flex-start" },
  greet: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  sub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  streakChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.secondaryMuted, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginLeft: 12 },
  streakNum: { color: theme.colors.secondary, fontWeight: "700", fontSize: 16 },
  streakWord: { color: theme.colors.secondary, fontSize: 12, fontWeight: "600" },
  aiCard: { marginTop: 16, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.brandMuted },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  aiBadgeText: { color: theme.colors.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  aiMsg: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  emptyTitle: { color: theme.colors.textPrimary, fontWeight: "700", fontSize: 16 },
  emptySub: { color: theme.colors.textSecondary, marginTop: 4 },
  doseRow: { flexDirection: "row", alignItems: "center" },
  medName: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  generic: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  dosage: { color: theme.colors.brand, fontSize: 14, marginTop: 4, fontWeight: "600" },
  statusLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 22, flex: 1 },
  takenBtn: { backgroundColor: theme.colors.brand },
  takenText: { color: theme.colors.textInverse, fontWeight: "700" },
  skipBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.error },
  skipText: { color: theme.colors.error, fontWeight: "700" },
  refillTag: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 8 },
  refillText: { color: theme.colors.warning, fontSize: 12, fontWeight: "600" },
  fab: { position: "absolute", right: 16, bottom: 80, height: 56, paddingHorizontal: 22, borderRadius: 28, backgroundColor: theme.colors.brand, flexDirection: "row", alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { color: theme.colors.textInverse, fontWeight: "700", fontSize: 16 },
});
