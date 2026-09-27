import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { ActionSheetModal } from "@/src/components/ActionSheetModal";
import { RefillModal } from "@/src/components/RefillModal";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { FlashAnnouncementBanner } from "@/src/components/FlashAnnouncementBanner";
import { YogaRoutineModal } from "@/src/components/YogaRoutineModal";
import { VideoPlayerModal } from "@/src/components/VideoPlayerModal";
import { DrugFoodGuideModal } from "@/src/components/DrugFoodGuideModal";
import { CalendarModal } from "@/src/components/CalendarModal";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { getFeatures } from "@/src/lib/features";
import { track, type EventName } from "@/src/lib/analytics";
import { api } from "@/src/lib/api";
import { resyncReminders } from "@/src/lib/notifications";
import { get, set, K } from "@/src/lib/store";
import { backgroundRefresh, enqueueWrite, flushQueue } from "@/src/lib/sync";

function ds() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function getWD(c: string) {
  const b = new Date(c), dy = b.getDay(), mn = new Date(b);
  mn.setDate(b.getDate() - ((dy + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mn); d.setDate(mn.getDate() + i);
    return { l: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i], n: d.getDate(), iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
  });
}
function gs(t: string) { const [h] = t.split(":").map(Number); return h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }

function getDoseWindow(scheduledTime: string, forDate?: string): { canMark: boolean; isFuture: boolean; isPast: boolean; minutesUntil: number } {
  if (forDate && forDate !== ds()) {
    if (forDate < ds()) return { canMark: false, isFuture: false, isPast: true, minutesUntil: -999999 };
    return { canMark: false, isFuture: true, isPast: false, minutesUntil: 999999 };
  }
  const now = new Date();
  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  const diffMinutes = (scheduled.getTime() - now.getTime()) / 60000;
  return {
    canMark: diffMinutes >= -240 && diffMinutes <= 120,
    isFuture: diffMinutes > 120,
    isPast: diffMinutes < -240,
    minutesUntil: Math.round(diffMinutes),
  };
}

function formatTimeUntil(minutes: number): string {
  if (minutes > 0) {
    if (minutes < 60) return `in ${minutes}m`;
    return `in ${Math.round(minutes / 60)}h`;
  }
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}m ago`;
  return `${Math.round(abs / 60)}h ago`;
}
const SI: any = { morning: "sunny-outline", afternoon: "partly-sunny-outline", evening: "moon-outline", night: "moon-outline" };

function Ring({ pct, textPrimary, accent, isDark }: { pct: number; textPrimary: string; accent: string; isDark: boolean }) {
  const R = 30, C = 2 * Math.PI * R, off = C - (pct / 100) * C;
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <Svg width={72} height={72} viewBox="0 0 72 72" style={{ position: "absolute" }}>
        <Circle cx={36} cy={36} r={R} fill="none" stroke={isDark ? "rgba(139,92,246,0.18)" : "rgba(79,70,229,0.1)"} strokeWidth={7} />
        <Circle cx={36} cy={36} r={R} fill="none" stroke={accent} strokeWidth={7}
          strokeDasharray={`${C}`} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 36 36)" />
      </Svg>
      <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "700" }}>{pct}%</Text>
    </View>
  );
}

export default function Today() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [date, setDate] = useState(ds());
  const [doses, setDoses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [addMed, setAddMed] = useState(false);
  const [refillMed, setRefillMed] = useState<any>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [yogaTipMeta, setYogaTipMeta] = useState("");
  const [waterLogged, setWaterLogged] = useState(0);
  const [waterGoal] = useState(2500);
  const [yogaModalOpen, setYogaModalOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string; channel?: string; benefit?: string } | null>(null);
  const [yogaReminderTime, setYogaReminderTime] = useState<string>("08:00");
  const [adherenceMap, setAdherenceMap] = useState<Record<string, number>>({});
  const [drugFoodGuide, setDrugFoodGuide] = useState<any>(null);
  const [foodGuideOpen, setFoodGuideOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const actionOptions = [
    {
      icon: "medical-outline",
      title: t("actionSheet.addMedication", "Add Medication"),
      body: t("actionSheet.addMedicationDesc", "Add a new medication to your routine"),
      fn: () => { setActionSheetOpen(false); setAddMed(true); },
    },
    {
      icon: "calendar-outline",
      title: t("actionSheet.bookAppointment", "Book Appointment"),
      body: t("actionSheet.bookAppointmentDesc", "Schedule a doctor appointment"),
      fn: () => { setActionSheetOpen(false); router.push("/appointments"); },
    },
    {
      icon: "pulse-outline",
      title: t("actionSheet.logMeasurement", "Log Measurement"),
      body: t("actionSheet.logMeasurementDesc", "Blood pressure, glucose, weight..."),
      fn: () => { setActionSheetOpen(false); router.push("/treatment?tab=measurements" as any); },
    },
    {
      icon: "body-outline",
      title: t("actionSheet.logActivity", "Log Activity"),
      body: t("actionSheet.logActivityDesc", "Steps, exercise, walking..."),
      fn: () => { setActionSheetOpen(false); router.push("/treatment?tab=activities" as any); },
    },
    {
      icon: "heart-outline",
      title: t("actionSheet.logMood", "Log Mood"),
      body: t("actionSheet.logMoodDesc", "Track how you're feeling today"),
      fn: () => { setActionSheetOpen(false); router.push("/treatment?tab=mood" as any); },
    },
  ];

  const fetchServer = async () => {
    try {
      await flushQueue().catch(() => {});
      const [dos, prof] = await Promise.all([
        api.listDoses(date),
        api.getProfile().catch(() => null),
      ]);
      if (dos && Array.isArray(dos)) {
        setDoses(dos);
        await set(K.doses(date), dos);
      }
      if (prof) setProfile(prof);

      api.adherence(30).then((data: any) => {
        if (data && typeof data === "object") setAdherenceMap(data);
      }).catch(() => {});

      api.getDrugFoodGuide().then((guide: any) => {
        if (guide) setDrugFoodGuide(guide);
      }).catch(() => {});

      const curMeds = (dos || []).map((d: any) => d.medication?.name).filter(Boolean);
      const prevMeds = ((await get("cached_med_names")) as string[]) || [];
      if (JSON.stringify(curMeds) !== JSON.stringify(prevMeds)) {
        await set("cached_med_names", curMeds);
        resyncReminders().catch(() => {});
      }
    } catch {
      const stored = ((await get(K.doses(date))) as any[]) || [];
      setDoses(stored.filter((d: any) => d.scheduled_time?.startsWith(date)));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServer();
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchServer(); }, [date]));

  useEffect(() => {
    const d = new Date().getDay();
    const tips = [
      "Consistent timing improves medicine effectiveness by 40%.",
      "Take medicines with water unless advised otherwise by your doctor.",
      "Never skip doses even if you feel better.",
      "Store medicines away from heat, moisture, and direct sunlight.",
      "Set alarms for recurring daily doses.",
      "Keep an updated list of your medications when visiting a doctor.",
      "Check expiry dates regularly and discard expired medicines safely."
    ];
    setAiMsg(tips[d % tips.length]);

    get<string>(K.yogaReminderTime).then((y) => {
      if (y) setYogaReminderTime(y);
    });

    const wKey = `water_${date}`;
    get<number>(wKey).then((logged) => {
      if (typeof logged === "number") setWaterLogged(logged);
    });
  }, [date]);

  const addWater = (amount: number) => {
    const next = waterLogged + amount;
    setWaterLogged(next);
    set(`water_${date}`, next);
  };

  const resetWater = () => {
    setWaterLogged(0);
    set(`water_${date}`, 0);
  };

  const mark = async (doseId: string, currentStatus: string, newStatus: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const taken_at = newStatus === "taken" ? new Date().toISOString() : undefined;
    const updated = doses.map((d: any) => d.id === doseId ? { ...d, status: newStatus, taken_at } : d);

    // 1. Instant optimistic UI & local storage update
    setDoses(updated);
    await set(K.doses(date), updated);

    // 2. Track analytics
    try {
      const evtName: EventName = newStatus === "taken" ? "dose_taken" : newStatus === "missed" ? "dose_missed" : "dose_skipped";
      track(evtName, { doseId });
    } catch {}

    // 3. Persist status to backend server and handle offline queue
    try {
      await api.setDoseStatus(doseId, newStatus, taken_at);
    } catch (err) {
      console.warn("API setDoseStatus failed, queueing offline write:", err);
      await enqueueWrite("doseStatus", { id: doseId, status: newStatus, taken_at });
    }
  };

  const days = getWD(date);
  const total = doses.length;
  const taken = doses.filter(d => d.status === "taken").length;
  const streak = profile?.streak_days ?? 0;
  const pct = total === 0 ? 0 : Math.round((taken / total) * 100);
  const secs: Record<string, any[]> = { morning: [], afternoon: [], evening: [], night: [] };
  doses.forEach(d => { const s = gs(d.scheduled_time || "08:00"); secs[s]?.push(d); });
  const pending = doses.filter(d => d.status === "pending" || !d.status);
  const next = pending.sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""))[0];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[s.appNm, { color: theme.textPrimary }]}>PillCare</Text>
        <View style={s.hdrR}>
          <TouchableOpacity style={[s.iBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surface }]} onPress={() => setCalOpen(true)}>
            <Ionicons name="calendar-outline" size={15} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={[s.sTag, { backgroundColor: theme.accentBg, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="flame" size={13} color={theme.accent} />
            <Text style={[s.sTx, { color: theme.accent }]}>{streak}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}>

        {/* Overview card */}
        <View style={[s.ov, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={[s.ovTag, { backgroundColor: theme.accentBg }]}><Text style={[s.ovTagTx, { color: theme.accent }]}>{profile?.nickname?.toUpperCase() || "YOU"}</Text></View>
            <Text style={[s.ovTitle, { color: theme.textPrimary }]}>{t("today.consistencyTitle", "Your consistency\nis your strength.")}</Text>
            <Text style={[s.ovSub, { color: theme.textSecondary }]}>{total === 0 ? t("today.firstMed", "Add your first medication.") : taken === total ? t("today.allDone", "All done for today!") : `${total - taken} ${t("today.medsLeft", "medication(s) left.")}`}</Text>
            <View style={{ gap: 4, marginTop: 4 }}>
              {next && <View style={s.mRow}><Ionicons name="time-outline" size={12} color={theme.accent} /><Text style={[s.mTx, { color: theme.textSecondary }]}>Next: <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>{next.medication?.name}</Text> at {next.scheduled_time}</Text></View>}
              <View style={s.mRow}><Ionicons name="flame" size={12} color={theme.accent} /><Text style={[s.mTx, { color: theme.textSecondary }]}>Streak: <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>{streak} {t("today.streakDays", "Days")}</Text></Text></View>
            </View>
          </View>
          <Ring pct={pct} textPrimary={theme.textPrimary} accent={theme.accent} isDark={isDark} />
        </View>

        {/* Week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {days.map(d => {
            const a = d.iso === date;
            return (
              <TouchableOpacity
                key={d.iso}
                onPress={() => setDate(d.iso)}
                style={[
                  s.pill,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  a && { backgroundColor: theme.accentBg, borderColor: theme.accent }
                ]}
              >
                <Text style={[s.pL, { color: theme.textSecondary }, a && { color: theme.accent, fontWeight: "800" }]}>{d.l}</Text>
                <Text style={[s.pN, { color: theme.textPrimary }, a && { color: theme.accent, fontWeight: "800" }]}>{d.n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Water Intake & Hydration Tracker Card */}
        <View style={[
          s.aiCard,
          {
            backgroundColor: isDark ? "rgba(14,165,233,0.08)" : "rgba(14,165,233,0.06)",
            borderColor: waterLogged >= 5000 ? "rgba(248,113,113,0.4)" : waterLogged >= waterGoal ? "rgba(74,222,128,0.4)" : "rgba(56,189,248,0.3)",
            marginTop: 10
          }
        ]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={s.aiH}>
              <Ionicons name="water" size={13} color={waterLogged >= 5000 ? "#f87171" : waterLogged >= waterGoal ? "#4ade80" : "#38bdf8"} />
              <Text style={[s.aiK, { color: waterLogged >= 5000 ? "#f87171" : waterLogged >= waterGoal ? "#4ade80" : "#38bdf8" }]}>
                {t("today.hydrationTitle", "HYDRATION & WATER TRACKER")}
              </Text>
            </View>
            <TouchableOpacity onPress={resetWater}>
              <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600" }}>{t("today.reset", "Reset")}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 }}>
            <View style={{ gap: 2, flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.textPrimary }}>
                {waterLogged} <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textSecondary }}>/ {waterGoal} mL</Text>
              </Text>
              {waterLogged >= 5000 ? (
                <Text style={{ fontSize: 11, color: "#f87171", fontWeight: "700" }}>
                  🛑 Max Limit Reached (5,000 mL). WHO standard: 2,500 mL/day.
                </Text>
              ) : waterLogged >= 3500 ? (
                <Text style={{ fontSize: 11, color: "#fbbf24", fontWeight: "700" }}>
                  ⚠️ High Hydration ({waterLogged} mL). Avoid fluid overload (&gt;4L).
                </Text>
              ) : waterLogged >= waterGoal ? (
                <Text style={{ fontSize: 11, color: "#4ade80", fontWeight: "700" }}>
                  🎉 Daily Goal Met! ({Math.round(waterLogged / 250)} glasses logged)
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>
                  {Math.round(waterLogged / 250)} of {Math.round(waterGoal / 250)} {t("today.glassesConsumed", "glasses consumed today")}
                </Text>
              )}
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: waterLogged >= 5000 ? "rgba(248,113,113,0.15)" : waterLogged >= waterGoal ? "rgba(74,222,128,0.15)" : "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="water" size={22} color={waterLogged >= 5000 ? "#f87171" : waterLogged >= waterGoal ? "#4ade80" : "#38bdf8"} />
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 10 }}>
            <View style={{ height: "100%", width: `${Math.min(100, Math.round((waterLogged / waterGoal) * 100))}%`, backgroundColor: waterLogged >= 5000 ? "#f87171" : waterLogged >= waterGoal ? "#4ade80" : "#38bdf8", borderRadius: 3 }} />
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.12)", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: waterLogged >= 5000 ? 0.4 : 1 }}
              onPress={() => addWater(250)}>
              <Ionicons name="add-circle-outline" size={14} color="#0284C7" />
              <Text style={{ fontSize: 12, color: "#0284C7", fontWeight: "700" }}>{t("today.addGlass", "+ Glass (250ml)")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: isDark ? "rgba(56,189,248,0.22)" : "rgba(56,189,248,0.18)", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, opacity: waterLogged >= 5000 ? 0.4 : 1 }}
              onPress={() => addWater(500)}>
              <Ionicons name="add" size={14} color="#0284C7" />
              <Text style={{ fontSize: 12, color: "#0284C7", fontWeight: "700" }}>{t("today.addBottle", "+ Bottle (500ml)")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Insight */}
        {aiMsg && (
          <View style={[s.aiCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={s.aiH}><Ionicons name="sparkles" size={12} color={theme.accent} /><Text style={[s.aiK, { color: theme.accent }]}>AI INSIGHT</Text></View>
            <Text style={[s.aiTx, { color: theme.textSecondary }]}>{aiMsg}</Text>
          </View>
        )}

        {/* AI Recommended Yoga Therapy Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[s.aiCard, { borderColor: "rgba(20,184,166,0.3)", backgroundColor: theme.surface }]}
          onPress={() => setYogaModalOpen(true)}>
          <View style={s.aiH}>
            <Ionicons name="leaf-outline" size={13} color="#14B8A6" />
            <Text style={[s.aiK, { color: "#14B8A6" }]}>
              {t("today.aiYogaBanner", "AI YOGA THERAPY")}
            </Text>
          </View>
          <Text style={[s.aiTx, { fontWeight: "700", color: theme.textPrimary, marginTop: 4, marginBottom: 2 }]}>
            {t("today.yogaFlowTitle", "Anulom Vilom & Pawanmuktasana Flow")}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 8 }}>
            {t("today.ayushVerified", "12 min • Verified Ministry of AYUSH & Swami Ramdev")}
          </Text>
          <View style={{ marginTop: 6 }}>
            <View style={{ width: "100%", backgroundColor: "rgba(20,184,166,0.12)", borderRadius: 10, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "rgba(20,184,166,0.3)" }}>
              <Ionicons name="play-circle-outline" size={16} color="#14B8A6" />
              <Text style={{ fontSize: 13, color: "#14B8A6", fontWeight: "700" }}>{t("today.viewRoutine", "View Routine & Guided Poses")}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Dose sections */}
        {total === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={[s.emI, { backgroundColor: theme.accentBg }]}><Ionicons name="medical-outline" size={26} color={theme.accent} /></View>
            <Text style={[s.emT, { color: theme.textPrimary }]}>{t("today.noDosesToday", "No pending medication doses for today!")}</Text>
            <Text style={[s.emS, { color: theme.textSecondary }]}>{t("treatment.noMedsDesc", "Tap + to add one")}</Text>
          </View>
        ) : ["morning", "afternoon", "evening", "night"].map(sec => {
          const items = secs[sec]; if (!items?.length) return null;
          return (
            <View key={sec} style={{ gap: 8, marginBottom: 6 }}>
              <View style={s.sH}><Ionicons name={SI[sec]} size={12} color={theme.accent} /><Text style={[s.sL, { color: theme.textSecondary }]}>{sec.toUpperCase()} • {items[0]?.scheduled_time}</Text></View>
              {items.map(dose => {
                const m = dose.medication || {}, st = dose.status || "pending";
                const tk = st === "taken", sk = st === "skipped", ms = st === "missed";
                return (
                  <View key={dose.id} style={[s.dc, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }, (tk) && { backgroundColor: theme.surfaceElevated, opacity: 0.7 }]}>
                    <View style={[s.dI, { backgroundColor: theme.accentBg }, tk && { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                      <Ionicons name="medical-outline" size={16} color={tk ? "#10B981" : theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dN, { color: theme.textPrimary }, (tk) && { color: theme.textSecondary }]}>{m.name || "Unknown"}</Text>
                      {m.generic_name ? <Text style={[s.dM, { color: theme.accent, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                      <Text style={[s.dM, { color: theme.textSecondary }]}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
                      {typeof m.stock === "number" ? (<Text style={[s.dM, { color: m.stock <= 0 ? "#f87171" : m.stock < 3 ? "#fbbf24" : theme.textSecondary, marginTop: 1 }]}>{m.stock <= 0 ? "Out of stock" : `${m.stock} left`}</Text>) : null}
                    </View>
                    {/* Time-locked dose actions */}
                    {(() => {
                      const win = getDoseWindow(dose.scheduled_time, date);
                      if (tk) return (
                        <View style={[s.bTk, { opacity: 1 }]}>
                          <Ionicons name="checkmark-circle" size={13} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>{t("today.taken", "Taken")}</Text>
                        </View>
                      );
                      if (ms || sk) return (
                        <View style={s.bSk}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#e58585" }}>{ms ? "Missed" : t("today.skipped", "Skipped")}</Text>
                        </View>
                      );
                      if (win.isFuture) return (
                        <View style={s.bLock}>
                          <Ionicons name="lock-closed" size={10} color={theme.textSecondary} />
                          <Text style={{ fontSize: 10, color: theme.textSecondary }}>{formatTimeUntil(win.minutesUntil)}</Text>
                        </View>
                      );
                      if (win.isPast) return (
                        <TouchableOpacity style={s.bMs} onPress={() => mark(dose.id, st, "missed")}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#e58585" }}>Mark Missed</Text>
                        </TouchableOpacity>
                      );
                      return (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <TouchableOpacity style={[s.bP, { backgroundColor: theme.accent }]} onPress={() => mark(dose.id, st, "taken")}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFF" }}>{t("today.markTaken", "Taken")}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Medication limit reached"
        description={`Free plan supports up to ${getFeatures().max_medications} medications. Upgrade to Pro Dharma for unlimited.`}
      />
      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={() => { setAddMed(false); backgroundRefresh(fetchServer); resyncReminders().catch(() => {}); }} />
      <RefillModal visible={!!refillMed} medication={refillMed} onClose={() => setRefillMed(null)} onRefilled={async () => { await fetchServer(); }} />
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
      <TouchableOpacity
        testID="fab-add-today-btn"
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => setActionSheetOpen(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <ActionSheetModal
        visible={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        options={actionOptions}
      />
      <CalendarModal
        visible={calOpen}
        selectedDate={date}
        onClose={() => setCalOpen(false)}
        onSelectDate={(newDate) => {
          setDate(newDate);
        }}
      />
      <FlashAnnouncementBanner />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  appNm: { fontSize: 18, fontWeight: "800" },
  hdrR: { flexDirection: "row", alignItems: "center", gap: 7 },
  iBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sTag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  sTx: { fontSize: 13, fontWeight: "700" },
  body: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },
  ov: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1 },
  ovTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginBottom: 4 },
  ovTagTx: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  ovTitle: { fontSize: 19, fontWeight: "800", lineHeight: 25, letterSpacing: -0.4 },
  ovSub: { fontSize: 12 },
  mRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  mTx: { fontSize: 11 },
  strip: { paddingVertical: 2, gap: 6 },
  pill: { width: 46, height: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1 },
  pL: { fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  pN: { fontSize: 17, fontWeight: "700" },
  aiCard: { borderRadius: 14, padding: 13, gap: 5, borderWidth: 1 },
  aiH: { flexDirection: "row", alignItems: "center", gap: 4 },
  aiK: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  aiTx: { fontSize: 12, lineHeight: 17 },
  sH: { flexDirection: "row", alignItems: "center", gap: 5 },
  sL: { fontSize: 10, letterSpacing: 0.7, fontWeight: "700" },
  dc: { borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1 },
  dI: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dN: { fontSize: 14, fontWeight: "700" },
  dM: { fontSize: 11, marginTop: 1 },
  bP: { height: 30, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bTk: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", alignItems: "center", justifyContent: "center", flexDirection: "row" },
  bSk: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(229,133,133,0.12)", alignItems: "center", justifyContent: "center" },
  bMs: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(229,133,133,0.1)", borderWidth: 1, borderColor: "rgba(229,133,133,0.2)", alignItems: "center", justifyContent: "center" },
  bLock: { height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  empty: { borderRadius: 18, padding: 36, alignItems: "center", gap: 8, borderWidth: 1 },
  emI: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emT: { fontSize: 15, fontWeight: "700" },
  emS: { fontSize: 12, textAlign: "center" },
  fab: { position: "absolute", right: 18, bottom: 24, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", elevation: 6, zIndex: 99 },
});
