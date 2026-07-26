import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { get, set, K } from "@/src/lib/store";
import { backgroundRefresh } from "@/src/lib/sync";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed", TM = "rgba(233,233,237,0.55)",
  AC = "#9184d9", A3 = "#a7a1db", AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";
const DL = ["M", "T", "W", "T", "F", "S", "S"];

export default function Progress() {
  const [adh, setAdh] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tab, setTab] = useState<"charts" | "list">("charts");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    get<any>(K.adherence).then(a => { if (a) setAdh(a); });
    get<any[]>(K.history).then(h => { if (h) setHistory(h); });
  }, []);

  const loadServer = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([api.adherence(7), api.doseHistory(30)]);
      setAdh(a); setHistory(h || []);
      set(K.adherence, a); set(K.history, h || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { backgroundRefresh(loadServer); }, [loadServer]));
  const onRefresh = async () => { setRefreshing(true); await loadServer(); setRefreshing(false); };

  const daily = adh?.daily || [], avg = adh?.average || 0, streak = adh?.streak || 0;
  const maxP = Math.max(...daily.map((d: any) => d.pct || 0), 1);
  const totalTaken = daily.reduce((s: number, d: any) => s + (d.taken || 0), 0);

  const barColor = (pct: number, isToday: boolean) => {
    if (isToday) return AC;
    if (pct >= 80) return "rgba(74,222,128,0.5)";
    if (pct >= 50) return "rgba(229,178,133,0.5)";
    if (pct > 0) return "rgba(229,133,133,0.5)";
    return "rgba(233,233,237,0.12)";
  };

  const statusIcon = (st: string) => st === "taken" ? "checkmark-circle" : st === "missed" ? "alert-circle" : st === "skipped" ? "close-circle" : "time-outline";
  const statusColor = (st: string) => st === "taken" ? A3 : st === "missed" ? "#e58585" : st === "skipped" ? "#e5b285" : TM;

  const formatDate = (d: string) => {
    const dt = new Date(d), today = new Date(), yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dt.toDateString() === today.toDateString()) return "Today";
    if (dt.toDateString() === yesterday.toDateString()) return "Yesterday";
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}><Text style={s.title}>Progress</Text><TouchableOpacity style={s.iBtn}><Ionicons name="share-outline" size={15} color={TX} /></TouchableOpacity></View>
      <View style={s.seg}>
        <TouchableOpacity style={[s.segO, tab === "charts" && s.segOn]} onPress={() => setTab("charts")}><Text style={[s.segT, tab === "charts" && s.segTOn]}>Charts</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segO, tab === "list" && s.segOn]} onPress={() => setTab("list")}><Text style={[s.segT, tab === "list" && s.segTOn]}>List</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AC} />}>

        {tab === "charts" && (<>
          <View style={s.card}>
            <View style={s.cH}>
              <View><Text style={s.cT}>Weekly Adherence</Text><Text style={s.cS}>Last 7 days</Text></View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.big, { color: avg >= 80 ? "#4ade80" : avg >= 50 ? "#e5b285" : "#e58585" }]}>{avg}%</Text>
                <Text style={s.bigS}>{avg >= 80 ? "on track" : avg >= 50 ? "improving" : "needs work"}</Text>
              </View>
            </View>
            <View style={s.bars}>
              {daily.length > 0 ? daily.map((d: any, i: number) => {
                const h = Math.max((d.pct / maxP) * 64, 4), isT = i === daily.length - 1;
                return (<View key={i} style={s.bCol}><View style={{ flex: 1, justifyContent: "flex-end" }}><View style={[s.bar, { height: h, backgroundColor: barColor(d.pct, isT) }]} /></View><Text style={s.bL}>{DL[i]}</Text></View>);
              }) : DL.map((l, i) => (<View key={i} style={s.bCol}><View style={{ flex: 1, justifyContent: "flex-end" }}><View style={[s.bar, { height: 16, backgroundColor: "rgba(233,233,237,0.1)" }]} /></View><Text style={s.bL}>{l}</Text></View>))}
            </View>
            {/* Legend */}
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
              {[["#4ade80", "≥80%"], ["#e5b285", "50-79%"], ["#e58585", "<50%"]].map(([c, l]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><Text style={{ fontSize: 9, color: TM }}>{l}</Text></View>
              ))}
            </View>
          </View>
          <View style={s.grid}>
            <View style={[s.card, { flex: 1, gap: 4 }]}><Ionicons name="flame" size={16} color={A3} /><Text style={s.stat}>{streak} <Text style={{ fontSize: 12, fontWeight: "400", color: TM }}>days</Text></Text><Text style={s.statL}>Current streak</Text></View>
            <View style={[s.card, { flex: 1, gap: 4 }]}><Ionicons name="checkmark-circle" size={16} color={A3} /><Text style={s.stat}>{totalTaken}</Text><Text style={s.statL}>Doses taken (7d)</Text></View>
          </View>
          <Text style={s.secL}>CONNECTED DEVICES</Text>
          <View style={s.card}>
            <View style={s.cRow}>
              <View style={s.cI}><Ionicons name="heart-outline" size={16} color={A3} /></View>
              <View style={{ flex: 1 }}><Text style={s.cT}>Health Connect</Text><Text style={s.cS}>Sync with Android health data</Text></View>
              <TouchableOpacity style={s.conBtn}><Text style={s.conT}>Connect</Text></TouchableOpacity>
            </View>
          </View>
          {adh && (<View style={[s.card, { flexDirection: "row", gap: 12, borderColor: "rgba(145,132,217,0.3)" }]}>
            <View style={[s.cI, { borderRadius: 18, width: 36, height: 36 }]}><Ionicons name="sparkles" size={17} color={A3} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}><Ionicons name="sparkles" size={10} color={A3} /><Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDATION</Text></View>
              <Text style={s.cT}>{avg < 80 ? "Review your evening doses" : "Keep up the great work!"}</Text>
              <Text style={s.cS}>{avg < 80 ? "Your adherence dips in later hours" : "You're consistently above 80%!"}</Text>
            </View>
          </View>)}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 }}>
            <Ionicons name="lock-closed-outline" size={11} color={TM} /><Text style={{ fontSize: 10, color: TM }}>Your data is safe and secure with us.</Text>
          </View>
        </>)}

        {tab === "list" && (<>
          {history.length === 0 ? (
            <View style={[s.card, { alignItems: "center", padding: 32, gap: 8 }]}>
              <Ionicons name="list-outline" size={28} color={AC} />
              <Text style={s.cT}>No history yet</Text>
              <Text style={s.cS}>Start logging medications to see your history</Text>
            </View>
          ) : history.map((day: any) => (
            <View key={day.date} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 2 }}>
                <Text style={[s.cS, { fontWeight: "600", color: TX }]}>{formatDate(day.date)}</Text>
                <Text style={[s.cS, { color: day.taken === day.total ? "#4ade80" : day.taken === 0 ? "#e58585" : TM }]}>{day.taken}/{day.total} taken</Text>
              </View>
              {day.entries.map((e: any) => (<View key={e.id} style={s.card}>
                <View style={s.cRow}>
                  <View style={[s.cI, { backgroundColor: e.status === "taken" ? "rgba(74,222,128,0.12)" : e.status === "missed" ? "rgba(229,133,133,0.12)" : e.status === "skipped" ? "rgba(229,178,133,0.12)" : AB }]}>
                    <Ionicons name={statusIcon(e.status) as any} size={15} color={statusColor(e.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cT}>{e.name}</Text>
                    {e.generic_name ? <Text style={[s.cS, { color: A3, fontStyle: "italic" }]}>{e.generic_name}</Text> : null}
                    <Text style={s.cS}>{e.dosage ? `${e.dosage} ${e.unit}` : e.unit || ""} • {e.time}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.cS, { color: statusColor(e.status), fontWeight: "600", textTransform: "capitalize" }]}>{e.status}</Text>
                  </View>
                </View>
              </View>))}
            </View>
          ))}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: TX, letterSpacing: -.4 }, iBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: SF, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: BD },
  segO: { flex: 1, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" }, segOn: { backgroundColor: "rgba(145,132,217,0.2)" },
  segT: { fontSize: 12, color: TM, fontWeight: "600" }, segTOn: { color: A3 },
  body: { padding: 16, paddingBottom: 110, gap: 12 }, card: { backgroundColor: SF, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: BD },
  cH: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, cT: { fontSize: 13, fontWeight: "600", color: TX }, cS: { fontSize: 10, color: TM, marginTop: 2 },
  cRow: { flexDirection: "row", alignItems: "center", gap: 10 }, cI: { width: 34, height: 34, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  big: { fontSize: 22, fontWeight: "700", letterSpacing: -.5 }, bigS: { fontSize: 9, color: TM },
  bars: { flexDirection: "row", height: 80, gap: 5 }, bCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" }, bar: { width: "100%", borderRadius: 4, minHeight: 3 }, bL: { fontSize: 8, color: TM, fontWeight: "600" },
  grid: { flexDirection: "row", gap: 10 }, stat: { fontSize: 20, fontWeight: "700", color: TX }, statL: { fontSize: 10, color: TM },
  secL: { fontSize: 10, letterSpacing: 1, color: TM, fontWeight: "700" },
  conBtn: { paddingHorizontal: 10, height: 28, borderRadius: 8, backgroundColor: AB, borderWidth: 1, borderColor: "rgba(145,132,217,0.25)", alignItems: "center", justifyContent: "center" }, conT: { fontSize: 10, color: A3, fontWeight: "700" },
});
