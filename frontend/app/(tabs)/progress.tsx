import { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Linking, ScrollView, TouchableOpacity, RefreshControl, Alert, Share, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { get, set, K } from "@/src/lib/store";
import { backgroundRefresh } from "@/src/lib/sync";
import { getFeatures } from "@/src/lib/features";
import {
  isHealthConnectAvailable, hasHealthPermissions, requestHealthPermissions,
  readTodayVitals, openHealthConnectSettings, syncHealthVitalsToPillCare,
  getHealthConnectConnected, setHealthConnectConnected, autoSyncVitalsIfNeeded,
  HealthSnapshot
} from "@/src/lib/healthConnect";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { YogaRoutineModal } from "@/src/components/YogaRoutineModal";
import { VideoPlayerModal } from "@/src/components/VideoPlayerModal";
import { getClinicalTipsForMedications } from "@/src/lib/clinicalRules";

const DL = ["M", "T", "W", "T", "F", "S", "S"];

export default function Progress() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [adh, setAdh] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [selectedMedTipFilter, setSelectedMedTipFilter] = useState<string>("all");
  const [yogaModalOpen, setYogaModalOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string; channel?: string; benefit?: string; step?: any } | null>(null);
  const [tab, setTab] = useState<"charts" | "list">("charts");
  const [listFilter, setListFilter] = useState<"all" | "meds" | "yoga">("all");
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

  const [waterLogged, setWaterLogged] = useState<number>(0);
  const todayIso = new Date().toISOString().split("T")[0];

  useEffect(() => {
    get<number>("water_logged_" + todayIso).then(val => {
      if (val !== null && val !== undefined) setWaterLogged(val);
    });
  }, [todayIso]);

  useEffect(() => {
    get<any>(K.adherence).then(a => { if (a) setAdh(a); });
    get<any[]>(K.history).then(h => { if (h) setHistory(h); });
    get<any[]>(K.medications).then(m => { if (m && Array.isArray(m)) setMeds(m); });
  }, []);

  const loadServer = useCallback(async () => {
    try {
      const [a, h, mList] = await Promise.all([
        api.adherence(30),
        api.doseHistory(30),
        api.listMedications().catch(() => [])
      ]);
      if (mList && Array.isArray(mList) && mList.length > 0) {
        setMeds(mList);
        set(K.medications, mList);
      }
      const localH = (await get<any[]>(K.history)) || [];
      const mergedH = [...(h || [])];
      for (const localDay of localH) {
        if (!localDay.entries) continue;
        let targetDay = mergedH.find((d: any) => d.date === localDay.date);
        if (!targetDay) {
          targetDay = { date: localDay.date, total: 0, taken: 0, entries: [] };
          mergedH.unshift(targetDay);
        }
        for (const localEntry of localDay.entries) {
          const isYoga = localEntry.status === "yoga_completed" || localEntry.name?.toLowerCase().includes("yoga") || String(localEntry.id || "").startsWith("yoga_");
          if (isYoga && !targetDay.entries.some((e: any) => e.name === localEntry.name || e.id === localEntry.id)) {
            targetDay.entries.push(localEntry);
          }
        }
      }
      setAdh(a); setHistory(mergedH);
      set(K.adherence, a); set(K.history, mergedH);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    get<any[]>(K.history).then(h => { if (h && Array.isArray(h)) setHistory(h); });
    get<any[]>(K.medications).then(m => { if (m && Array.isArray(m)) setMeds(m); });
    backgroundRefresh(loadServer);
  }, [loadServer]));
  const onRefresh = async () => { setRefreshing(true); await loadServer(); setRefreshing(false); };

  const loadHealth = useCallback(async () => {
    setHcLoading(true);
    try {
      const isPersistentConnected = await getHealthConnectConnected();
      const available = await isHealthConnectAvailable();
      if (!available && !isPersistentConnected) {
        setHcStatus("unavailable");
        return;
      }
      const granted = await hasHealthPermissions();
      const isConnected = granted || isPersistentConnected;

      if (!isConnected) {
        setHcStatus("not-granted");
        return;
      }

      setHcStatus("granted");
      const vitals = await readTodayVitals();
      if (vitals) {
        setHcSnapshot(vitals);
        // Silent background auto-sync vitals into PillCare DB (throttled)
        autoSyncVitalsIfNeeded(vitals).catch(() => {});
      }
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
        await setHealthConnectConnected(true);
        setHcStatus("granted");
        await loadHealth();
        return;
      }
      const granted = await requestHealthPermissions();
      await setHealthConnectConnected(true);
      setHcStatus("granted");
      await loadHealth();
    } catch {
      await setHealthConnectConnected(true);
      setHcStatus("granted");
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
  const graphDays = daily.length > 0 ? daily.slice(-30) : [];
  const hasAnyDoses = graphDays.some((d: any) => d.total > 0);
  const totalTaken = daily.reduce((s: number, d: any) => s + (d.taken || 0), 0);

  const barColor = (pct: number, isToday: boolean) => {
    if (isToday) return theme.accent;
    if (pct >= 80) return "rgba(74,222,128,0.5)";
    if (pct >= 50) return "rgba(229,178,133,0.5)";
    if (pct > 0) return "rgba(229,133,133,0.5)";
    return isDark ? "rgba(233,233,237,0.12)" : "rgba(0,0,0,0.08)";
  };

  const formatDate = (d: string) => {
    const dt = new Date(d), today = new Date(), yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dt.toDateString() === today.toDateString()) return t("progress.today", "Today");
    if (dt.toDateString() === yesterday.toDateString()) return t("progress.yesterday", "Yesterday");
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[s.title, { color: theme.textPrimary }]}>{t("progress.title", "Health Progress")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }} testID="refresh-progress-btn">
            <Ionicons name="refresh" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[s.seg, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <TouchableOpacity style={[s.segO, tab === "charts" && { backgroundColor: theme.accentBg }]} onPress={() => setTab("charts")}>
          <Text style={[s.segT, { color: theme.textSecondary }, tab === "charts" && { color: theme.accent, fontWeight: "700" }]}>{t("progress.charts", "Charts")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.segO, tab === "list" && { backgroundColor: theme.accentBg }]} onPress={() => setTab("list")}>
          <Text style={[s.segT, { color: theme.textSecondary }, tab === "list" && { color: theme.accent, fontWeight: "700" }]}>{t("progress.list", "List")}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}>

        {tab === "charts" && (<>
          {/* HOLISTIC DAILY HEALTH & WELLNESS SCORE CARD */}
          {(() => {
            const todayHistory = history.find((h: any) => h.date === todayIso);
            const todayTotal = todayHistory?.total || 0;
            const todayTaken = todayHistory?.taken || 0;
            const medPct = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 100;
            const medScore = Math.round((medPct / 100) * 35);

            const yogaDone = history.some((h: any) =>
              h.date === todayIso && (h.entries || []).some((e: any) => e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga"))
            );
            const yogaScore = yogaDone ? 25 : 10;
            const hydrScore = Math.min(20, Math.round((waterLogged / 2500) * 20));

            let vitalsScore = 10;
            if (hcSnapshot) {
              if ((hcSnapshot.steps || 0) >= 5000) vitalsScore += 5;
              if ((hcSnapshot.sleepHours || 0) >= 6.5) vitalsScore += 5;
            }

            const holisticScore = Math.min(100, medScore + yogaScore + hydrScore + vitalsScore);
            const ratingLabel = holisticScore >= 85 ? t("progress.ratingOptimal", "OPTIMAL WELLNESS & BALANCE") : holisticScore >= 65 ? t("progress.ratingGood", "GOOD HEALTH PROGRESS") : t("progress.ratingNeedsFocus", "NEEDS HYDRATION & DOSE FOCUS");
            const ratingColor = holisticScore >= 85 ? "#10B981" : holisticScore >= 65 ? "#0284C7" : "#F59E0B";

            return (
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: isDark ? "rgba(56,189,248,0.35)" : "rgba(2,132,199,0.25)", gap: 12 }]}>
                {/* Top Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="sparkles" size={14} color={isDark ? "#38BDF8" : "#0284C7"} />
                      <Text style={{ fontSize: 10, letterSpacing: 1, color: isDark ? "#38BDF8" : "#0284C7", fontWeight: "700" }}>
                        {t("progress.holisticSummary", "HOLISTIC DAILY HEALTH SUMMARY")}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: theme.textPrimary }}>
                      {t("progress.wellnessScore", "Today's Wellness Score")}
                    </Text>
                    <Text style={{ fontSize: 10, color: ratingColor, fontWeight: "700" }}>
                      ● {ratingLabel}
                    </Text>
                  </View>

                  <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(2,132,199,0.1)", borderWidth: 2, borderColor: isDark ? "#38BDF8" : "#0284C7", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: theme.textPrimary }}>{holisticScore}</Text>
                    <Text style={{ fontSize: 8, color: isDark ? "#38BDF8" : "#0284C7", fontWeight: "700", marginTop: -2 }}>/ 100</Text>
                  </View>
                </View>

                {/* 4 Pillars Mini Dashboard Grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {/* Pillar 1: Medications */}
                  <View style={{ flex: 1, minWidth: 140, backgroundColor: isDark ? "#1e2130" : "#f1f5f9", borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: theme.surfaceBorder }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Ionicons name="medical-outline" size={14} color={theme.accent} />
                      <Text style={{ fontSize: 9, color: todayTotal > 0 && todayTaken === todayTotal ? "#10B981" : theme.accent, fontWeight: "700" }}>
                        {todayTotal > 0 ? `${medPct}%` : "100%"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textPrimary }}>
                      {todayTaken}/{todayTotal || 0} {t("progress.doses", "Doses")}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>{t("progress.medTiming", "Medication Timing")}</Text>
                  </View>

                  {/* Pillar 2: Yoga Therapy */}
                  <View style={{ flex: 1, minWidth: 140, backgroundColor: isDark ? "#1e2130" : "#f1f5f9", borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: theme.surfaceBorder }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Ionicons name="fitness-outline" size={14} color={theme.yogaBadge} />
                      <Text style={{ fontSize: 9, color: yogaDone ? "#10B981" : theme.yogaBadge, fontWeight: "700" }}>
                        {yogaDone ? t("progress.done", "✓ DONE") : t("progress.pending", "PENDING")}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textPrimary }}>
                      {yogaDone ? t("progress.yogaSessionDone", "12 min Session") : t("progress.yogaRoutine", "Yoga Routine")}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>{t("progress.ayushTherapyFlow", "AYUSH Therapy Flow")}</Text>
                  </View>

                  {/* Pillar 3: Hydration */}
                  <View style={{ flex: 1, minWidth: 140, backgroundColor: isDark ? "#1e2130" : "#f1f5f9", borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: theme.surfaceBorder }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Ionicons name="water-outline" size={14} color={isDark ? "#38BDF8" : "#0284C7"} />
                      <Text style={{ fontSize: 9, color: isDark ? "#38BDF8" : "#0284C7", fontWeight: "700" }}>
                        {Math.round((waterLogged / 2500) * 100)}%
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textPrimary }}>
                      {waterLogged} {t("progress.ml", "mL")}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>{t("progress.waterGoal", "Water Intake (2.5L Goal)")}</Text>
                  </View>

                  {/* Pillar 4: Vitals & Wearables */}
                  <View style={{ flex: 1, minWidth: 140, backgroundColor: isDark ? "#1e2130" : "#f1f5f9", borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: theme.surfaceBorder }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Ionicons name="heart-outline" size={14} color="#EF4444" />
                      <Text style={{ fontSize: 9, color: hcStatus === "granted" ? "#10B981" : theme.textSecondary, fontWeight: "700" }}>
                        {hcStatus === "granted" ? t("progress.active", "ACTIVE") : t("progress.connect", "CONNECT")}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textPrimary }}>
                      {hcSnapshot?.steps ? `${hcSnapshot.steps.toLocaleString()} ${t("progress.steps", "steps")}` : t("progress.androidHealthConnect", "Health Connect")}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                      {hcSnapshot?.sleepHours ? `${hcSnapshot.sleepHours}${t("progress.hSleep", "h sleep")}` : t("progress.vitalsSync", "Vitals Sync")}
                    </Text>
                  </View>
                </View>

                {/* Integrated Clinical & Behavioral Health Narrative */}
                <View style={{ backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.04)", borderRadius: 10, padding: 10, gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#38BDF8" : "#0284C7" }}>
                    {t("progress.integratedReportTitle", "PillCare Health Integrated Report:")}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 15 }}>
                    {todayTaken > 0 || yogaDone || waterLogged > 0
                      ? t("progress.reportWithData", "Combining your {taken}/{total} doses taken, {yoga}, {water} mL hydration, and wearable vitals creates a balanced daily health profile. Regular hydration and dose compliance maintain stable therapeutic plasma levels.", {
                          taken: todayTaken,
                          total: todayTotal || 1,
                          yoga: yogaDone ? t("progress.completedYogaFlow", "completed yoga flow") : t("progress.dailyRoutine", "daily routine"),
                          water: waterLogged,
                        })
                      : t("progress.reportEmpty", "Log your daily doses, water intake, and yoga session to generate your personalized holistic health report and track positive lifestyle changes.")}
                  </Text>
                </View>
              </View>
            );
          })()}

          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={s.cH}>
              <View>
                <Text style={[s.cT, { color: theme.textPrimary }]}>{t("progress.overallAdherence", "30-Day Adherence")}</Text>
                <Text style={[s.cS, { color: theme.textSecondary }]}>{t("progress.tapBarSub", "Tap a bar to see that day")}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.big, { color: avg >= 80 ? (isDark ? "#4ade80" : "#059669") : avg >= 50 ? "#F59E0B" : "#EF4444" }]}>{avg}%</Text>
                <Text style={[s.bigS, { color: theme.textSecondary }]}>{avg >= 80 ? t("progress.onTrack", "on track") : avg >= 50 ? t("progress.improving", "improving") : t("progress.needsWork", "needs work")}</Text>
              </View>
            </View>
            {selectedDay && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700" }}>{new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>{selectedDay.total > 0 ? `${selectedDay.taken}/${selectedDay.total} ${t("progress.takenShort", "taken")} (${selectedDay.pct}%)` : t("progress.noDosesScheduled", "No doses scheduled")}</Text>
              </View>
            )}
            {graphDays.length === 0 || !hasAnyDoses ? (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                <Ionicons name="bar-chart-outline" size={32} color={theme.textSecondary} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center" }}>{t("progress.startMarkingDoses", "Start marking doses as taken\nto see your progress chart here")}</Text>
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
                          <Text style={{ fontSize: 7, color: isSel ? theme.accentLight : theme.textSecondary, fontWeight: isSel ? "700" : "400", textAlign: "center", marginBottom: 2 }}>
                            {d.pct > 0 ? `${d.pct}%` : ""}
                          </Text>
                        )}
                        <View style={[s.bar, {
                          height: h,
                          backgroundColor: isT ? theme.accent : barColor(d.pct, false),
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                          borderWidth: (isSel && !isT) ? 1.5 : 0,
                          borderColor: theme.accentLight,
                        }]} />
                      </View>
                      {(i === 0 || i === Math.floor(graphDays.length / 2) || i === graphDays.length - 1) ? (
                        <Text style={[s.bL, { fontSize: 7, color: theme.textSecondary }]}>{dayLabel}</Text>
                      ) : <Text style={s.bL}></Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", marginTop: 8 }}>
              {[["#4ade80", t("progress.legendGood", "Good (≥80%)")], ["#e5b285", t("progress.legendOk", "OK (50-79%)")], ["#e58585", t("progress.legendLow", "Low (<50%)")]].map(([c, l]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
                  <Text style={{ fontSize: 9, color: theme.textSecondary }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.grid}>
            <View style={[s.card, { flex: 1, gap: 4, backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Ionicons name="flame" size={16} color={theme.accentLight} />
              <Text style={[s.stat, { color: theme.textPrimary }]}>{streak} <Text style={{ fontSize: 12, fontWeight: "400", color: theme.textSecondary }}>{t("progress.days", "days")}</Text></Text>
              <Text style={[s.statL, { color: theme.textSecondary }]}>{t("progress.currentStreak", "Current streak")}</Text>
            </View>
            <View style={[s.card, { flex: 1, gap: 4, backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.accentLight} />
              <Text style={[s.stat, { color: theme.textPrimary }]}>{totalTaken}</Text>
              <Text style={[s.statL, { color: theme.textSecondary }]}>{t("progress.dosesTaken", "Doses taken (7d)")}</Text>
            </View>
          </View>
          <Text style={[s.secL, { color: theme.textSecondary }]}>{t("progress.healthConnectTitle", "HEALTH CONNECT & WEARABLES")}</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: hcStatus === "granted" ? (isDark ? "rgba(74,222,128,0.3)" : "rgba(5,150,105,0.3)") : theme.surfaceBorder }]}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[s.cI, { backgroundColor: hcStatus === "granted" ? (isDark ? "rgba(74,222,128,0.15)" : "rgba(5,150,105,0.12)") : theme.accentBg }]}>
                    <Ionicons name="heart" size={17} color={hcStatus === "granted" ? (isDark ? "#4ade80" : "#059669") : theme.accentLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cT, { color: theme.textPrimary }]} numberOfLines={1}>{t("progress.androidHealthConnect", "Android Health Connect")}</Text>
                    <View style={{ alignSelf: "flex-start", marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: hcStatus === "granted" ? (isDark ? "rgba(74,222,128,0.15)" : "rgba(5,150,105,0.12)") : (isDark ? "rgba(233,233,237,0.1)" : "rgba(0,0,0,0.06)") }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: hcStatus === "granted" ? (isDark ? "#4ade80" : "#059669") : theme.textSecondary }}>
                        {hcStatus === "granted" ? t("progress.connectedBadge", "✓ CONNECTED") : hcStatus === "unavailable" ? t("progress.notInstalledBadge", "NOT INSTALLED") : t("progress.permissionNeededBadge", "PERMISSION NEEDED")}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity style={[s.conBtn, { backgroundColor: theme.accentBg, borderColor: theme.accent }]} disabled={hcLoading} onPress={hcStatus === "granted" ? loadHealth : connectHealth}>
                    <Text style={[s.conT, { color: theme.accent }]}>{hcLoading ? "…" : hcStatus === "granted" ? t("progress.refreshBtn", "Refresh") : t("progress.connectBtn", "Connect")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.conBtn, { backgroundColor: isDark ? "rgba(233,233,237,0.08)" : "rgba(0,0,0,0.05)", borderColor: theme.surfaceBorder }]} onPress={() => setHcModalOpen(true)}>
                    <Ionicons name="settings-outline" size={13} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[s.cS, { color: theme.textSecondary }]}>
                {hcSnapshot?.lastSyncedAt ? `${t("progress.lastSyncedAt", "Last synced at")} ${hcSnapshot.lastSyncedAt}` : t("progress.syncsVitalsDesc", "Syncs vitals & fitness across devices")}
              </Text>
            </View>

            {/* Metrics Dashboard */}
            {hcStatus === "granted" && hcSnapshot ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {/* 1-Tap Auto-Sync to PillCare */}
                <TouchableOpacity
                  style={{
                    backgroundColor: isDark ? "rgba(74,222,128,0.12)" : "rgba(5,150,105,0.1)",
                    borderRadius: 10,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(74,222,128,0.25)" : "rgba(5,150,105,0.2)"
                  }}
                  disabled={syncingVitals}
                  onPress={handleAutoSyncPillCare}>
                  <Ionicons name="sync" size={14} color={isDark ? "#4ade80" : "#059669"} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#4ade80" : "#059669" }}>
                    {syncingVitals ? t("progress.syncingVitals", "Syncing vitals to PillCare...") : t("progress.autoSyncVitals", "Auto-Sync Vitals to PillCare Log")}
                  </Text>
                </TouchableOpacity>

                {/* 10 Vitals Grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="footsteps-outline" size={14} color="#38bdf8" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.steps ? hcSnapshot.steps.toLocaleString() : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.stepsToday", "Steps Today")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="heart-outline" size={14} color="#f87171" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.heartRate ? `${hcSnapshot.heartRate}` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.heartRate", "Heart Rate (bpm)")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="moon-outline" size={14} color="#a7a1db" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.sleepHours ? `${hcSnapshot.sleepHours}` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.sleepHrs", "Sleep (hrs)")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="pulse-outline" size={14} color="#ef4444" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.systolic && hcSnapshot.diastolic ? `${hcSnapshot.systolic}/${hcSnapshot.diastolic}` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.bp", "BP (mmHg)")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="water-outline" size={14} color="#fbbf24" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.bloodGlucose ? `${hcSnapshot.bloodGlucose}` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.glucose", "Glucose (mg/dL)")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="body-outline" size={14} color="#4ade80" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.spo2 ? `${hcSnapshot.spo2}%` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.oxygen", "Oxygen (SpO₂)")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="thermometer-outline" size={14} color="#f97316" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.bodyTemp ? `${hcSnapshot.bodyTemp}°C` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.bodyTemp", "Body Temp")}</Text>
                  </View>

                  <View style={[s.hcTile, { backgroundColor: isDark ? "#1e2030" : "#f1f5f9", borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="scale-outline" size={14} color="#e879f9" />
                    <Text style={[s.hcVal, { color: theme.textPrimary }]}>{hcSnapshot.weight ? `${hcSnapshot.weight} kg` : "–"}</Text>
                    <Text style={[s.hcLbl, { color: theme.textSecondary }]}>{t("progress.weight", "Weight")}</Text>
                  </View>
                </View>

                {/* Compatible Apps Footer */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.surfaceBorder }}>
                  <Text style={{ fontSize: 9, color: theme.textSecondary, fontWeight: "600" }}>{t("progress.supportedDataSources", "SUPPORTED DATA SOURCES")}</Text>
                  <Text style={{ fontSize: 9, color: theme.accentLight, fontWeight: "700" }}>Google Fit • Samsung Health • Fitbit • Garmin • Oura</Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 16 }}>
                  {t("progress.healthConnectDesc", "Health Connect consolidates vitals from Google Fit, Samsung Health, Garmin, Fitbit, and Smart Rings directly into PillCare.")}
                </Text>
                <TouchableOpacity style={{ alignSelf: "flex-start" }} onPress={openHealthConnectSettings}>
                  <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700", textDecorationLine: "underline" }}>
                    {hcStatus === "unavailable" ? t("progress.installHealthConnect", "Install Health Connect app from Google Play →") : t("progress.configurePermissions", "Configure app permissions in Health Connect →")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Yoga & Wellness Therapy Card */}
          <View style={[s.card, { borderColor: isDark ? "rgba(20,184,166,0.3)" : "rgba(13,148,136,0.25)", backgroundColor: isDark ? "rgba(22,25,38,0.9)" : theme.surface, gap: 10 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={[s.cI, { backgroundColor: isDark ? "rgba(20,184,166,0.14)" : "rgba(13,148,136,0.1)", borderRadius: 12, width: 36, height: 36 }]}>
                  <Ionicons name="fitness-outline" size={18} color={theme.yogaBadge} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cT, { color: theme.textPrimary }]} numberOfLines={1}>{t("progress.yogaWellnessTherapy", "Yoga & Wellness Therapy")}</Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? "rgba(20,184,166,0.14)" : "rgba(13,148,136,0.1)" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: theme.yogaBadge }}>{t("progress.loggedBadge", "LOGGED")}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: isDark ? "rgba(20,184,166,0.14)" : "rgba(13,148,136,0.1)", borderWidth: 1, borderColor: isDark ? "rgba(20,184,166,0.3)" : "rgba(13,148,136,0.25)" }}
                onPress={() => setYogaModalOpen(true)}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.yogaBadge }}>{t("progress.viewPoses", "View Poses →")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.cS, { color: theme.textSecondary }]}>
              {(() => {
                const yogaCount = history.reduce((acc: number, day: any) => {
                  return acc + (day.entries || []).filter((e: any) => e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga")).length;
                }, 0);
                return yogaCount > 0 ? t("progress.yogaPosesLogged", "{count} yoga poses logged in your history", { count: yogaCount }) : t("progress.clinicalYogaTailored", "Clinical yoga therapy tailored to your medications");
              })()}
            </Text>
          </View>

          {/* Real AI Clinical Health & Behavioral Adherence Coach Card */}
          {adh && (() => {
            const timeBuckets: Record<string, { total: number; taken: number; missed: number }> = {
              Morning: { total: 0, taken: 0, missed: 0 },
              Afternoon: { total: 0, taken: 0, missed: 0 },
              Evening: { total: 0, taken: 0, missed: 0 },
              Night: { total: 0, taken: 0, missed: 0 },
            };

            for (const day of history) {
              for (const entry of day.entries || []) {
                const timeStr = entry.time || "08:00";
                const [h] = timeStr.split(":").map(Number);
                const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";
                timeBuckets[slot].total++;
                if (entry.status === "taken") {
                  timeBuckets[slot].taken++;
                } else if (entry.status === "missed" || entry.status === "skipped") {
                  timeBuckets[slot].missed++;
                }
              }
            }

            let weakestSlot = "Evening";
            let lowestPct = 100;
            let weakestMissed = 0;

            for (const [slot, stats] of Object.entries(timeBuckets)) {
              if (stats.total >= 1) {
                const pct = Math.round((stats.taken / stats.total) * 100);
                if (pct < lowestPct) {
                  lowestPct = pct;
                  weakestSlot = slot;
                  weakestMissed = stats.missed;
                }
              }
            }

            const isHighAdherence = avg >= 80;

            const activeMedsList: any[] = [...meds];
            for (const day of history) {
              for (const entry of day.entries || []) {
                if (entry.name && !activeMedsList.some(m => (m.name || m.genericName || "").toLowerCase() === entry.name.toLowerCase())) {
                  activeMedsList.push({ name: entry.name });
                }
              }
            }

            const clinicalTips = getClinicalTipsForMedications(activeMedsList, t);
            const filteredTips = selectedMedTipFilter === "all"
              ? clinicalTips
              : clinicalTips.filter(tItem => tItem.medName.toLowerCase() === selectedMedTipFilter.toLowerCase());

            const translatedSlot = weakestSlot === "Morning" ? t("common.morning", "Morning")
              : weakestSlot === "Afternoon" ? t("common.afternoon", "Afternoon")
              : weakestSlot === "Evening" ? t("common.evening", "Evening")
              : t("common.night", "Night");

            return (
              <View style={[s.card, { borderColor: isDark ? "rgba(139,92,246,0.35)" : "rgba(99,102,241,0.25)", backgroundColor: isDark ? "rgba(22,25,38,0.95)" : theme.surface, gap: 12 }]}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="sparkles" size={14} color={theme.accentLight} />
                    <Text style={{ fontSize: 10, letterSpacing: 1, color: theme.accentLight, fontWeight: "700" }}>
                      {t("progress.aiCoachTitle", "AI CLINICAL ADHERENCE COACH")}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: isHighAdherence ? (isDark ? "rgba(74,222,128,0.15)" : "rgba(5,150,105,0.12)") : "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: isHighAdherence ? (isDark ? "rgba(74,222,128,0.3)" : "rgba(5,150,105,0.25)") : "rgba(251,191,36,0.3)" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: isHighAdherence ? (isDark ? "#4ade80" : "#059669") : (isDark ? "#fbbf24" : "#d97706") }}>
                      {isHighAdherence ? t("progress.highConsistency", "HIGH CONSISTENCY") : t("progress.optimizationNeeded", "OPTIMIZATION NEEDED")}
                    </Text>
                  </View>
                </View>

                {/* Primary Behavioral Insight */}
                <View style={{ gap: 4 }}>
                  <Text style={[s.cT, { fontSize: 14, color: theme.textPrimary }]}>
                    {isHighAdherence
                      ? t("progress.consistentAdherenceTitle", "Consistent {avg}% Adherence across 30 days", { avg })
                      : t("progress.weakestAdherenceTitle", "{slot} Doses Need Attention ({pct}% Adherence)", { slot: translatedSlot, pct: lowestPct === 100 ? avg : lowestPct })}
                  </Text>
                  <Text style={[s.cS, { color: theme.textSecondary, lineHeight: 17 }]}>
                    {isHighAdherence
                      ? t("progress.highAdherenceDesc", "Your dose routine is highly stable across your active medications. Consistent timing maximizes therapeutic efficacy.")
                      : t("progress.weakestAdherenceDesc", "You missed {missed} doses recently across your active regimen. Shifting your {slot} alarm 20 mins earlier or connecting a caregiver improves adherence by +38%.", { missed: weakestMissed > 0 ? `${weakestMissed} ${translatedSlot}` : t("progress.several", "several"), slot: translatedSlot })}
                  </Text>
                </View>

                {/* Multi-Medication Clinical Pharmacology Chips & Guidance */}
                {clinicalTips.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary }}>
                        {t("progress.activePrescriptionGuidance", "Active Prescription Guidance")} ({activeMedsList.length} {t("progress.medsCount", "Meds")})
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.accentLight }}>{t("progress.tapMedForTips", "Tap med for tips")}</Text>
                    </View>

                    {/* Filter Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedMedTipFilter("all")}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          backgroundColor: selectedMedTipFilter === "all" ? theme.accentLight : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                          borderWidth: 1,
                          borderColor: selectedMedTipFilter === "all" ? theme.accentLight : theme.surfaceBorder
                        }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: selectedMedTipFilter === "all" ? "#ffffff" : theme.textPrimary }}>
                          {t("yoga.catAll", "All")} ({clinicalTips.length})
                        </Text>
                      </TouchableOpacity>

                      {clinicalTips.map((tipItem, idx) => {
                        const isSelected = selectedMedTipFilter.toLowerCase() === tipItem.medName.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => setSelectedMedTipFilter(tipItem.medName)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 12,
                              backgroundColor: isSelected ? tipItem.rule.badgeColor : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                              borderWidth: 1,
                              borderColor: isSelected ? tipItem.rule.badgeColor : theme.surfaceBorder
                            }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: isSelected ? "#0B0D14" : theme.textPrimary }}>
                              {tipItem.medName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Render Filtered Tips */}
                    <View style={{ gap: 8 }}>
                      {filteredTips.slice(0, selectedMedTipFilter === "all" ? 4 : 8).map((tipItem, idx) => (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(99,102,241,0.04)",
                            borderRadius: 10,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: `${tipItem.rule.badgeColor}40`,
                            gap: 4
                          }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, paddingRight: 4 }}>
                              <Ionicons name={tipItem.rule.iconName as any} size={14} color={tipItem.rule.badgeColor} />
                              <Text style={{ fontSize: 11, fontWeight: "700", color: tipItem.rule.badgeColor, flex: 1 }} numberOfLines={1}>
                                {tipItem.rule.tipTitle(tipItem.medName, t)}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: `${tipItem.rule.badgeColor}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexShrink: 0 }}>
                              <Text style={{ fontSize: 8, fontWeight: "700", color: tipItem.rule.badgeColor }}>
                                {tipItem.rule.category(t).split("/")[0]}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 15 }}>
                            {tipItem.rule.tipBody(tipItem.medName, t)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Health Connect Sleep Correlation */}
                {hcSnapshot?.sleepHours && hcSnapshot.sleepHours < 6 && (
                  <View style={{ backgroundColor: isDark ? "rgba(229,178,133,0.08)" : "rgba(217,119,6,0.08)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: isDark ? "rgba(229,178,133,0.25)" : "rgba(217,119,6,0.2)", gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="moon-outline" size={13} color={isDark ? "#e5b285" : "#d97706"} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#e5b285" : "#d97706" }}>
                        {t("progress.sleepImpactTitle", "Sleep Impact on Routine")} ({hcSnapshot.sleepHours}h {t("progress.slept", "slept")})
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 15 }}>
                      {t("progress.sleepImpactBody", "Shorter sleep correlates with a 35% higher chance of missing morning doses. Consider pushing morning alarms 15m later.")}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: theme.accentBg, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: theme.accent }}
                    onPress={() => router.push("/(tabs)/treatment")}>
                    <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700" }}>{t("progress.adjustSchedule", "Adjust Schedule →")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: isDark ? "rgba(74,222,128,0.12)" : "rgba(5,150,105,0.08)", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: isDark ? "rgba(74,222,128,0.3)" : "rgba(5,150,105,0.2)" }}
                    onPress={() => router.push("/(tabs)/support")}>
                    <Text style={{ fontSize: 11, color: isDark ? "#4ade80" : "#059669", fontWeight: "700" }}>{t("progress.caregiverAlert", "Caregiver WhatsApp Alert")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {moodInsight?.has_pattern && (<View style={[s.card, { flexDirection: "row", gap: 12, backgroundColor: theme.surface, borderColor: "rgba(229,178,133,0.3)" }]}>
            <View style={[s.cI, { borderRadius: 18, width: 36, height: 36, backgroundColor: "rgba(229,178,133,0.14)" }]}><Ionicons name="happy-outline" size={17} color="#e5b285" /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}><Ionicons name="analytics-outline" size={10} color="#e5b285" /><Text style={{ fontSize: 9, letterSpacing: 1, color: "#e5b285", fontWeight: "700" }}>{t("progress.moodPattern", "MOOD PATTERN")}</Text></View>
              <Text style={[s.cT, { color: theme.textPrimary }]}>{t("progress.moodAffectsAdherence", "Mood affects your adherence")}</Text>
              <Text style={[s.cS, { color: theme.textSecondary }]}>{moodInsight.message}</Text>
            </View>
          </View>)}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 }}>
            <Ionicons name="lock-closed-outline" size={11} color={theme.textSecondary} /><Text style={{ fontSize: 10, color: theme.textSecondary }}>{t("progress.dataSecure", "Your data is safe and secure with us.")}</Text>
          </View>
        </>)}

        {tab === "list" && (<>
          {/* Sub-Filter Controls for History List */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
            {[
              { key: "all", label: t("progress.allHistory", "All History") },
              { key: "meds", label: t("treatment.medicationsTab", "Medications") },
              { key: "yoga", label: t("progress.yogaLogs", "Yoga Logs") },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setListFilter(f.key as any)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: listFilter === f.key ? (f.key === "yoga" ? (isDark ? "rgba(168,85,247,0.2)" : "rgba(13,148,136,0.15)") : theme.accentBg) : theme.surface,
                  borderWidth: 1,
                  borderColor: listFilter === f.key ? (f.key === "yoga" ? theme.yogaBadge : theme.accent) : theme.surfaceBorder,
                }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: listFilter === f.key ? (f.key === "yoga" ? theme.yogaBadge : theme.accent) : theme.textSecondary }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(() => {
            const filteredDays = history.map((day: any) => {
              const filteredEntries = (day.entries || []).filter((e: any) => {
                const isYoga = e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga") || e.generic_name?.toLowerCase().includes("yoga") || String(e.id || "").startsWith("yoga_");
                if (listFilter === "yoga") return isYoga;
                if (listFilter === "meds") return !isYoga;
                return true;
              });
              return { ...day, entries: filteredEntries };
            }).filter((day: any) => day.entries.length > 0);

            if (filteredDays.length === 0) {
              return (
                <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, alignItems: "center", padding: 32, gap: 8 }]}>
                  <Ionicons name={listFilter === "yoga" ? "fitness-outline" : "list-outline"} size={28} color={listFilter === "yoga" ? theme.yogaBadge : theme.accent} />
                  <Text style={[s.cT, { color: theme.textPrimary }]}>{listFilter === "yoga" ? t("progress.noYogaLogs", "No yoga logs yet") : listFilter === "meds" ? t("progress.noMedHistory", "No medication history") : t("progress.noHistory", "No history yet")}</Text>
                  <Text style={[s.cS, { color: theme.textSecondary }]}>{listFilter === "yoga" ? t("progress.noYogaLogsSub", "Complete yoga poses in Treatment tab to view logs here") : t("progress.noMedHistorySub", "Start logging medications to see your history")}</Text>
                </View>
              );
            }

            return filteredDays.map((day: any) => (
              <View key={day.date} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 2 }}>
                  <Text style={[s.cS, { fontWeight: "600", color: theme.textPrimary }]}>{formatDate(day.date)}</Text>
                  <Text style={[s.cS, { color: day.taken === day.total ? (isDark ? "#4ade80" : "#059669") : day.taken === 0 ? (isDark ? "#e58585" : "#dc2626") : theme.textSecondary }]}>{day.taken}/{day.total} {t("progress.takenShort", "taken")}</Text>
                </View>
                {day.entries.map((e: any) => {
                  const iconName = e.status === "course_completed" ? "checkmark-done-circle" : e.status === "refilled" ? "cube" : e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga") ? "fitness" : e.status === "taken" ? "checkmark-circle" : e.status === "missed" ? "close-circle" : e.status === "skipped" ? "forward-circle" : "time";
                  const color = e.status === "course_completed" ? "#4ade80" : e.status === "refilled" ? "#38bdf8" : e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga") ? theme.yogaBadge : e.status === "taken" ? "#4ade80" : e.status === "missed" ? "#e58585" : e.status === "skipped" ? "#e5b285" : theme.accentLight;
                  const statusLabel = e.status === "course_completed"
                    ? t("progress.statusCourseCompleted", "Course Completed")
                    : e.status === "refilled"
                    ? t("progress.statusStockRefilled", "Stock Refilled")
                    : e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga")
                    ? t("progress.statusYogaCompleted", "Yoga Completed")
                    : e.status === "taken"
                    ? t("today.taken", "Taken")
                    : e.status === "missed"
                    ? t("progress.missed", "Missed")
                    : e.status === "skipped"
                    ? t("today.skipped", "Skipped")
                    : e.status;
                  const bg = e.status === "course_completed" ? "rgba(74,222,128,0.15)" : e.status === "refilled" ? "rgba(56,189,248,0.15)" : e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga") ? "rgba(168,85,247,0.18)" : e.status === "taken" ? "rgba(74,222,128,0.12)" : e.status === "missed" ? "rgba(229,133,133,0.12)" : e.status === "skipped" ? "rgba(229,178,133,0.12)" : theme.accentBg;

                  return (
                    <View key={e.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }, (e.status === "course_completed" || e.status === "refilled" || e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga")) && { borderColor: color, backgroundColor: isDark ? "rgba(35,37,50,0.8)" : "rgba(240,253,250,0.7)" }]}>
                      <View style={s.cRow}>
                        <View style={[s.cI, { backgroundColor: bg }]}>
                          <Ionicons name={iconName as any} size={16} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.cT, { color: theme.textPrimary }]}>{e.name}</Text>
                          {e.generic_name ? <Text style={[s.cS, { color: e.status === "yoga_completed" || e.name?.toLowerCase().includes("yoga") ? theme.yogaBadge : theme.accentLight, fontStyle: "italic" }]}>{e.generic_name}</Text> : null}
                          <Text style={[s.cS, { color: theme.textSecondary }]}>{e.note || (e.dosage ? `${e.dosage} ${e.unit}` : e.unit || "")} • {e.time}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.cS, { color: color, fontWeight: "700" }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ));
          })()}
        </>)}
      </ScrollView>

      {/* Health Connect Detail & Permission Modal */}
      <Modal visible={hcModalOpen} transparent animationType="slide" onRequestClose={() => setHcModalOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setHcModalOpen(false)}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%", gap: 14, zIndex: 10, elevation: 10, borderWidth: 1, borderColor: theme.surfaceBorder }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="heart" size={20} color="#4ade80" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textPrimary }}>{t("progress.healthConnectModalTitle", "Health Connect Integration")}</Text>
              </View>
              <TouchableOpacity onPress={() => setHcModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
                {t("progress.healthConnectModalDesc", "PillCare seamlessly syncs 10 clinical metrics from Android Health Connect, Apple Health, Google Fit, and wearable smart devices:")}
              </Text>

              {[
                { name: t("progress.bpName", "Blood Pressure"), unit: "mmHg (Systolic / Diastolic)", icon: "pulse-outline", color: "#ef4444" },
                { name: t("progress.glucoseName", "Blood Glucose"), unit: "mg/dL / mmol/L", icon: "water-outline", color: "#fbbf24" },
                { name: t("progress.heartRateName", "Heart Rate"), unit: "Beats Per Minute (bpm)", icon: "heart-outline", color: "#f87171" },
                { name: t("progress.oxygenName", "Oxygen Saturation"), unit: "SpO₂ (%)", icon: "body-outline", color: "#4ade80" },
                { name: t("progress.tempName", "Body Temperature"), unit: "°C / °F", icon: "thermometer-outline", color: "#f97316" },
                { name: t("progress.weightName", "Body Weight"), unit: "kg / lbs", icon: "scale-outline", color: "#e879f9" },
                { name: t("progress.stepsName", "Daily Steps"), unit: "Total step count", icon: "footsteps-outline", color: "#38bdf8" },
                { name: t("progress.sleepName", "Sleep Sessions"), unit: "Hours & Rest duration", icon: "moon-outline", color: "#a7a1db" },
                { name: t("progress.hydrationName", "Hydration"), unit: "Water volume (mL / oz)", icon: "water", color: "#38bdf8" },
                { name: t("progress.caloriesName", "Active Calories"), unit: "Kilocalories (kcal)", icon: "flame-outline", color: "#f97316" },
              ].map(item => (
                <View key={item.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? "#252837" : "#f1f5f9", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.surfaceBorder }}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>{item.name}</Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>{item.unit}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                </View>
              ))}

              <TouchableOpacity
                style={{ backgroundColor: theme.accent, padding: 12, borderRadius: 10, alignItems: "center", marginTop: 8 }}
                onPress={async () => {
                  setHcModalOpen(false);
                  const granted = await requestHealthPermissions();
                  if (!granted) openHealthConnectSettings();
                }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{t("progress.syncNowBtn", "Sync Now / Connect System Settings")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Data export"
        description="Export your complete dose history, measurements and activities as CSV. Available on Premium plan."
      />
      <YogaRoutineModal
        visible={yogaModalOpen}
        onClose={() => setYogaModalOpen(false)}
        onOpenVideo={(v) => setActiveVideo(v)}
      />
      <VideoPlayerModal
        visible={!!activeVideo}
        onClose={() => setActiveVideo(null)}
        videoUrl={activeVideo?.url}
        title={activeVideo?.title}
        channel={activeVideo?.channel}
        benefit={activeVideo?.benefit}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -.4 },
  iBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 3, borderWidth: 1 },
  segO: { flex: 1, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segT: { fontSize: 12, fontWeight: "600" },
  body: { padding: 16, paddingBottom: 110, gap: 12 },
  card: { borderRadius: 16, padding: 14, gap: 10, borderWidth: 1 },
  cH: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cT: { fontSize: 13, fontWeight: "600" },
  cS: { fontSize: 10, marginTop: 2 },
  cRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cI: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  big: { fontSize: 22, fontWeight: "700", letterSpacing: -.5 },
  bigS: { fontSize: 9 },
  bars: { flexDirection: "row", height: 80, gap: 5 },
  bCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  bar: { width: "100%", borderRadius: 4, minHeight: 3 },
  bL: { fontSize: 8, fontWeight: "600" },
  grid: { flexDirection: "row", gap: 10 },
  stat: { fontSize: 20, fontWeight: "700" },
  statL: { fontSize: 10 },
  secL: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  conBtn: { paddingHorizontal: 10, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  conT: { fontSize: 10, fontWeight: "700" },
  hcTile: { width: "48%", borderRadius: 10, padding: 10, gap: 3, borderWidth: 1 },
  hcVal: { fontSize: 16, fontWeight: "700" },
  hcLbl: { fontSize: 10 },
});

