import { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Linking, ScrollView, TouchableOpacity, RefreshControl, Alert, Share, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { get, set, K } from "@/src/lib/store";
import { backgroundRefresh } from "@/src/lib/sync";
import { getFeatures } from "@/src/lib/features";
import { isHealthConnectAvailable, hasHealthPermissions, requestHealthPermissions, readTodayVitals, openHealthConnectSettings, syncHealthVitalsToPillCare, HealthSnapshot } from "@/src/lib/healthConnect";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed", TM = "rgba(233,233,237,0.55)",
  AC = "#9184d9", A3 = "#a7a1db", AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";
const DL = ["M", "T", "W", "T", "F", "S", "S"];

export default function Progress() {
  const [adh, setAdh] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tab, setTab] = useState<"charts" | "list">("charts");
  const router = useRouter();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hcStatus, setHcStatus] = useState<"unknown" | "unavailable" | "not-granted" | "granted">("unknown");
  const [hcSnapshot, setHcSnapshot] = useState<HealthSnapshot | null>(null);
  const [hcLoading, setHcLoading] = useState(false);
  const [syncingVitals, setSyncingVitals] = useState(false);
  const [hcModalOpen, setHcModalOpen] = useState(false);
  const [moodInsight, setMoodInsight] = useState<any>(null);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  useEffect(() => {
    get<any>(K.adherence).then(a => { if (a) setAdh(a); });
    get<any[]>(K.history).then(h => { if (h) setHistory(h); });
  }, []);

  const loadServer = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([api.adherence(30), api.doseHistory(30)]);
      setAdh(a); setHistory(h || []);
      set(K.adherence, a); set(K.history, h || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { backgroundRefresh(loadServer); }, [loadServer]));
  const onRefresh = async () => { setRefreshing(true); await loadServer(); setRefreshing(false); };

  const loadHealth = useCallback(async () => {
    setHcLoading(true);
    try {
      const available = await isHealthConnectAvailable();
      if (!available) { setHcStatus("unavailable"); return; }
      const granted = await hasHealthPermissions();
      if (!granted) { setHcStatus("not-granted"); return; }
      const vitals = await readTodayVitals();
      setHcSnapshot(vitals);
      setHcStatus(vitals.granted ? "granted" : "not-granted");
    } catch {
      setHcStatus("unavailable");
    } finally {
      setHcLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHealth(); }, [loadHealth]));

  const loadMoodInsight = useCallback(async () => {
    try { const r = await api.moodAdherenceInsight(14); setMoodInsight(r); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadMoodInsight(); }, [loadMoodInsight]));

  const connectHealth = async () => {
    setHcLoading(true);
    try {
      const available = await isHealthConnectAvailable();
      if (!available) {
        Alert.alert("Health Connect not available", "Install the Health Connect app from the Play Store to sync vitals and fitness.");
        setHcStatus("unavailable");
        return;
      }
      const granted = await requestHealthPermissions();
      if (granted) {
        await loadHealth();
      } else {
        setHcStatus("not-granted");
      }
    } catch {
      setHcStatus("unavailable");
    } finally {
      setHcLoading(false);
    }
  };

  const handleAutoSyncPillCare = async () => {
    if (!hcSnapshot) return;
    setSyncingVitals(true);
    try {
      const res = await syncHealthVitalsToPillCare(hcSnapshot);
      Alert.alert("Vitals Synced!", `Successfully logged ${res.syncedCount} vitals into your PillCare measurements and activities.`);
    } catch {
      Alert.alert("Sync Error", "Could not sync vitals right now.");
    } finally {
      setSyncingVitals(false);
    }
  };

  const daily = adh?.daily || [], avg = adh?.average || 0, streak = adh?.streak || 0;
  // Show last 30 days in graph
  // Show last 30 days — pad with empty days if fewer available
  const graphDays = daily.length > 0 ? daily.slice(-30) : [];
  const hasAnyDoses = graphDays.some((d: any) => d.total > 0);
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
      <View style={s.hdr}>
          <Text style={s.title}>Progress</Text>
          <TouchableOpacity style={[s.iBtn, {flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:10,borderRadius:10,backgroundColor:"rgba(145,132,217,0.1)"}]}
            onPress={async () => {
              const features = getFeatures();
              if (!features.export_data) {
                setShowUpgrade(true);
                return;
              }
              if (exporting) return;
              setExporting(true);
              try {
                const csv = await api.exportCsv();
                if (!isMounted.current) return;
                await Share.share({ title: "PillCare Health Data", message: csv });
              } catch {
                if (isMounted.current) Alert.alert("Export failed", "Please check your connection and try again.");
              } finally {
                if (isMounted.current) setExporting(false);
              }
            }}>
            <Ionicons name="download-outline" size={14} color={AC} />
            <Text style={{fontSize:12,color:AC,fontWeight:"700"}}>{exporting ? "Exporting…" : "Export CSV"}</Text>
          </TouchableOpacity>
        </View>
      <View style={s.seg}>
        <TouchableOpacity style={[s.segO, tab === "charts" && s.segOn]} onPress={() => setTab("charts")}><Text style={[s.segT, tab === "charts" && s.segTOn]}>Charts</Text></TouchableOpacity>
        <TouchableOpacity style={[s.segO, tab === "list" && s.segOn]} onPress={() => setTab("list")}><Text style={[s.segT, tab === "list" && s.segTOn]}>List</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AC} />}>

        {tab === "charts" && (<>
          <View style={s.card}>
            <View style={s.cH}>
              <View><Text style={s.cT}>30-Day Adherence</Text><Text style={s.cS}>Tap a bar to see that day</Text></View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.big, { color: avg >= 80 ? "#4ade80" : avg >= 50 ? "#e5b285" : "#e58585" }]}>{avg}%</Text>
                <Text style={s.bigS}>{avg >= 80 ? "on track" : avg >= 50 ? "improving" : "needs work"}</Text>
              </View>
            </View>
            {selectedDay && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: A3, fontWeight: "700" }}>{new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</Text>
                <Text style={{ fontSize: 11, color: TM }}>{selectedDay.total > 0 ? `${selectedDay.taken}/${selectedDay.total} taken (${selectedDay.pct}%)` : "No doses scheduled"}</Text>
              </View>
            )}
            {graphDays.length === 0 || !hasAnyDoses ? (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                <Ionicons name="bar-chart-outline" size={32} color={TM} />
                <Text style={{ fontSize: 13, color: TM, textAlign: "center" }}>Start marking doses as taken{"\n"}to see your progress chart here</Text>
              </View>
            ) : (
              <View style={[s.bars, { height: 100, gap: 2 }]}>
                {graphDays.map((d: any, i: number) => {
                  const h = Math.max((d.pct / 100) * 80, d.total > 0 ? 4 : 2);
                  const isT = i === graphDays.length - 1;
                  const isSel = selectedDay?.date === d.date;
                  const dayLabel = d.date ? new Date(d.date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric" }) : "";
                  return (
                    <TouchableOpacity key={i} style={[s.bCol, { gap: 2 }]} activeOpacity={0.6} onPress={() => setSelectedDay(d)}>
                      <View style={{ flex: 1, justifyContent: "flex-end", width: "100%", alignItems: "center" }}>
                        {d.total > 0 && (isSel || isT) && (
                          <Text style={{ fontSize: 7, color: isSel ? A3 : TM, fontWeight: isSel ? "700" : "400", textAlign: "center", marginBottom: 2 }}>
                            {d.pct > 0 ? `${d.pct}%` : ""}
                          </Text>
                        )}
                        <View style={[s.bar, {
                          height: h,
                          backgroundColor: isT ? AC : barColor(d.pct, false),
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                          borderWidth: (isSel && !isT) ? 1.5 : 0,
                          borderColor: A3,
                        }]} />
                      </View>
                      {(i === 0 || i === Math.floor(graphDays.length / 2) || i === graphDays.length - 1) ? (
                        <Text style={[s.bL, { fontSize: 7 }]}>{dayLabel}</Text>
                      ) : <Text style={s.bL}></Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", marginTop: 8 }}>
              {[["#4ade80", "Good (≥80%)"], ["#e5b285", "OK (50-79%)"], ["#e58585", "Low (<50%)"]].map(([c, l]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
                  <Text style={{ fontSize: 9, color: TM }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.grid}>
            <View style={[s.card, { flex: 1, gap: 4 }]}><Ionicons name="flame" size={16} color={A3} /><Text style={s.stat}>{streak} <Text style={{ fontSize: 12, fontWeight: "400", color: TM }}>days</Text></Text><Text style={s.statL}>Current streak</Text></View>
            <View style={[s.card, { flex: 1, gap: 4 }]}><Ionicons name="checkmark-circle" size={16} color={A3} /><Text style={s.stat}>{totalTaken}</Text><Text style={s.statL}>Doses taken (7d)</Text></View>
          </View>
          <Text style={s.secL}>HEALTH CONNECT & WEARABLES</Text>
          <View style={[s.card, { borderColor: hcStatus === "granted" ? "rgba(74,222,128,0.3)" : BD }]}>
            <View style={s.cRow}>
              <View style={[s.cI, { backgroundColor: hcStatus === "granted" ? "rgba(74,222,128,0.15)" : AB }]}>
                <Ionicons name="heart" size={17} color={hcStatus === "granted" ? "#4ade80" : A3} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.cT}>Android Health Connect</Text>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: hcStatus === "granted" ? "rgba(74,222,128,0.15)" : "rgba(233,233,237,0.1)" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: hcStatus === "granted" ? "#4ade80" : TM }}>
                      {hcStatus === "granted" ? "✓ CONNECTED" : hcStatus === "unavailable" ? "NOT INSTALLED" : "PERMISSION NEEDED"}
                    </Text>
                  </View>
                </View>
                <Text style={s.cS}>
                  {hcSnapshot?.lastSyncedAt ? `Last synced at ${hcSnapshot.lastSyncedAt}` : "Syncs vitals & fitness across devices"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity style={s.conBtn} disabled={hcLoading} onPress={hcStatus === "granted" ? loadHealth : connectHealth}>
                  <Text style={s.conT}>{hcLoading ? "…" : hcStatus === "granted" ? "Refresh" : "Connect"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.conBtn, { backgroundColor: "rgba(233,233,237,0.08)", borderColor: BD }]} onPress={() => setHcModalOpen(true)}>
                  <Ionicons name="settings-outline" size={13} color={TX} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Metrics Dashboard */}
            {hcStatus === "granted" && hcSnapshot ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {/* 1-Tap Auto-Sync to PillCare */}
                <TouchableOpacity
                  style={{
                    backgroundColor: "rgba(74,222,128,0.12)",
                    borderRadius: 10,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: "rgba(74,222,128,0.25)"
                  }}
                  disabled={syncingVitals}
                  onPress={handleAutoSyncPillCare}>
                  <Ionicons name="sync" size={14} color="#4ade80" />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#4ade80" }}>
                    {syncingVitals ? "Syncing vitals to PillCare..." : "Auto-Sync Vitals to PillCare Log"}
                  </Text>
                </TouchableOpacity>

                {/* 10 Vitals Grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View style={s.hcTile}>
                    <Ionicons name="footsteps-outline" size={14} color="#38bdf8" />
                    <Text style={s.hcVal}>{hcSnapshot.steps ? hcSnapshot.steps.toLocaleString() : "–"}</Text>
                    <Text style={s.hcLbl}>Steps Today</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="heart-outline" size={14} color="#f87171" />
                    <Text style={s.hcVal}>{hcSnapshot.heartRate ? `${hcSnapshot.heartRate}` : "–"}</Text>
                    <Text style={s.hcLbl}>Heart Rate (bpm)</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="moon-outline" size={14} color="#a7a1db" />
                    <Text style={s.hcVal}>{hcSnapshot.sleepHours ? `${hcSnapshot.sleepHours}` : "–"}</Text>
                    <Text style={s.hcLbl}>Sleep (hrs)</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="pulse-outline" size={14} color="#ef4444" />
                    <Text style={s.hcVal}>{hcSnapshot.systolic && hcSnapshot.diastolic ? `${hcSnapshot.systolic}/${hcSnapshot.diastolic}` : "–"}</Text>
                    <Text style={s.hcLbl}>BP (mmHg)</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="water-outline" size={14} color="#fbbf24" />
                    <Text style={s.hcVal}>{hcSnapshot.bloodGlucose ? `${hcSnapshot.bloodGlucose}` : "–"}</Text>
                    <Text style={s.hcLbl}>Glucose (mg/dL)</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="body-outline" size={14} color="#4ade80" />
                    <Text style={s.hcVal}>{hcSnapshot.spo2 ? `${hcSnapshot.spo2}%` : "–"}</Text>
                    <Text style={s.hcLbl}>Oxygen (SpO₂)</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="thermometer-outline" size={14} color="#f97316" />
                    <Text style={s.hcVal}>{hcSnapshot.bodyTemp ? `${hcSnapshot.bodyTemp}°C` : "–"}</Text>
                    <Text style={s.hcLbl}>Body Temp</Text>
                  </View>

                  <View style={s.hcTile}>
                    <Ionicons name="scale-outline" size={14} color="#e879f9" />
                    <Text style={s.hcVal}>{hcSnapshot.weight ? `${hcSnapshot.weight} kg` : "–"}</Text>
                    <Text style={s.hcLbl}>Weight</Text>
                  </View>
                </View>

                {/* Compatible Apps Footer */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTopWidth: 1, borderTopColor: BD }}>
                  <Text style={{ fontSize: 9, color: TM, fontWeight: "600" }}>SUPPORTED DATA SOURCES</Text>
                  <Text style={{ fontSize: 9, color: A3, fontWeight: "700" }}>Google Fit • Samsung Health • Fitbit • Garmin • Oura</Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: TM, lineHeight: 16 }}>
                  Health Connect consolidates vitals from Google Fit, Samsung Health, Garmin, Fitbit, and Smart Rings directly into PillCare.
                </Text>
                <TouchableOpacity style={{ alignSelf: "flex-start" }} onPress={openHealthConnectSettings}>
                  <Text style={{ fontSize: 11, color: AC, fontWeight: "700", textDecorationLine: "underline" }}>
                    {hcStatus === "unavailable" ? "Install Health Connect app from Google Play →" : "Configure app permissions in Health Connect →"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {adh && (<View style={[s.card, { flexDirection: "row", gap: 12, borderColor: "rgba(145,132,217,0.3)" }]}>
            <View style={[s.cI, { borderRadius: 18, width: 36, height: 36 }]}><Ionicons name="sparkles" size={17} color={A3} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}><Ionicons name="sparkles" size={10} color={A3} /><Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDATION</Text></View>
              <Text style={s.cT}>{avg < 80 ? "Review your evening doses" : "Keep up the great work!"}</Text>
              <Text style={s.cS}>{avg < 80 ? "Your adherence dips in later hours" : "You're consistently above 80%!"}</Text>
            </View>
          </View>)}
          {moodInsight?.has_pattern && (<View style={[s.card, { flexDirection: "row", gap: 12, borderColor: "rgba(229,178,133,0.3)" }]}>
            <View style={[s.cI, { borderRadius: 18, width: 36, height: 36, backgroundColor: "rgba(229,178,133,0.14)" }]}><Ionicons name="happy-outline" size={17} color="#e5b285" /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}><Ionicons name="analytics-outline" size={10} color="#e5b285" /><Text style={{ fontSize: 9, letterSpacing: 1, color: "#e5b285", fontWeight: "700" }}>MOOD PATTERN</Text></View>
              <Text style={s.cT}>Mood affects your adherence</Text>
              <Text style={s.cS}>{moodInsight.message}</Text>
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
              {day.entries.map((e: any) => {
                const iconName = e.status === "course_completed" ? "checkmark-done-circle" : e.status === "refilled" ? "cube" : e.status === "taken" ? "checkmark-circle" : e.status === "missed" ? "close-circle" : e.status === "skipped" ? "forward-circle" : "time";
                const color = e.status === "course_completed" ? "#4ade80" : e.status === "refilled" ? "#38bdf8" : e.status === "taken" ? "#4ade80" : e.status === "missed" ? "#e58585" : e.status === "skipped" ? "#e5b285" : A3;
                const statusLabel = e.status === "course_completed" ? "Course Completed" : e.status === "refilled" ? "Stock Refilled" : e.status;
                const bg = e.status === "course_completed" ? "rgba(74,222,128,0.15)" : e.status === "refilled" ? "rgba(56,189,248,0.15)" : e.status === "taken" ? "rgba(74,222,128,0.12)" : e.status === "missed" ? "rgba(229,133,133,0.12)" : e.status === "skipped" ? "rgba(229,178,133,0.12)" : AB;

                return (
                  <View key={e.id} style={[s.card, (e.status === "course_completed" || e.status === "refilled") && { borderColor: color, backgroundColor: "rgba(35,37,50,0.8)" }]}>
                    <View style={s.cRow}>
                      <View style={[s.cI, { backgroundColor: bg }]}>
                        <Ionicons name={iconName as any} size={16} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cT}>{e.name}</Text>
                        {e.generic_name ? <Text style={[s.cS, { color: A3, fontStyle: "italic" }]}>{e.generic_name}</Text> : null}
                        <Text style={s.cS}>{e.note || (e.dosage ? `${e.dosage} ${e.unit}` : e.unit || "")} • {e.time}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.cS, { color: color, fontWeight: "700" }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </>)}
      </ScrollView>

      {/* Health Connect Detail & Permission Modal */}
      <Modal visible={hcModalOpen} transparent animationType="slide" onRequestClose={() => setHcModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1c1e2d", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%", gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="heart" size={20} color="#4ade80" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Health Connect Integration</Text>
              </View>
              <TouchableOpacity onPress={() => setHcModalOpen(false)}>
                <Ionicons name="close" size={22} color={TX} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <Text style={{ fontSize: 12, color: TM, lineHeight: 17 }}>
                PillCare seamlessly syncs 10 clinical metrics from Android Health Connect, Apple Health, Google Fit, and wearable smart devices:
              </Text>

              {[
                { name: "Blood Pressure", unit: "mmHg (Systolic / Diastolic)", icon: "pulse-outline", color: "#ef4444" },
                { name: "Blood Glucose", unit: "mg/dL / mmol/L", icon: "water-outline", color: "#fbbf24" },
                { name: "Heart Rate", unit: "Beats Per Minute (bpm)", icon: "heart-outline", color: "#f87171" },
                { name: "Oxygen Saturation", unit: "SpO₂ (%)", icon: "body-outline", color: "#4ade80" },
                { name: "Body Temperature", unit: "°C / °F", icon: "thermometer-outline", color: "#f97316" },
                { name: "Body Weight", unit: "kg / lbs", icon: "scale-outline", color: "#e879f9" },
                { name: "Daily Steps", unit: "Total step count", icon: "footsteps-outline", color: "#38bdf8" },
                { name: "Sleep Sessions", unit: "Hours & Rest duration", icon: "moon-outline", color: "#a7a1db" },
                { name: "Hydration", unit: "Water volume (mL / oz)", icon: "water", color: "#38bdf8" },
                { name: "Active Calories", unit: "Kilocalories (kcal)", icon: "flame-outline", color: "#f97316" },
              ].map(item => (
                <View key={item.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#252837", padding: 10, borderRadius: 10 }}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: TX }}>{item.name}</Text>
                    <Text style={{ fontSize: 10, color: TM }}>{item.unit}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                </View>
              ))}

              <TouchableOpacity
                style={{ backgroundColor: AC, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 6 }}
                onPress={() => {
                  setHcModalOpen(false);
                  openHealthConnectSettings();
                }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Open Health Connect Android Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Data export"
        description="Export your complete dose history, measurements and activities as CSV. Available on Premium plan."
      />
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
  hcTile: { width: "48%", backgroundColor: "#1e2030", borderRadius: 10, padding: 10, gap: 3, borderWidth: 1, borderColor: BD },
  hcVal: { fontSize: 16, fontWeight: "700", color: TX }, hcLbl: { fontSize: 10, color: TM },
});
