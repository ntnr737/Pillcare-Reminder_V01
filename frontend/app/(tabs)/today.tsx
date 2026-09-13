import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { RefillModal } from "@/src/components/RefillModal";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { getFeatures } from "@/src/lib/features";
import { track } from "@/src/lib/analytics";
import { api } from "@/src/lib/api";
import { resyncReminders } from "@/src/lib/notifications";
import { get, set, K } from "@/src/lib/store";
import { flushQueue, backgroundRefresh, recordTaken, mergeDoses, enqueueWrite } from "@/src/lib/sync";

const BG = "#0B0D14", SF = "#161926", N8 = "#2A2E42", TX = "#F9FAFB",
  TM = "rgba(249, 250, 251, 0.65)", TD = "rgba(249, 250, 251, 0.35)",
  AC = "#8B5CF6", A3 = "#A78BFA", AB = "rgba(139, 92, 246, 0.18)", BD = "rgba(255, 255, 255, 0.08)",
  REFILL = "#06B6D4", SUCCESS = "#10B981";

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

/**
 * Time window for dose marking.
 * A dose can only be marked TAKEN within 2h before and 4h after scheduled time.
 * Outside this window: future = UPCOMING (locked), past = auto MISSED.
 * This prevents morning dose being marked from evening and vice versa.
 */
function getDoseWindow(scheduledTime: string, forDate?: string): { canMark: boolean; isFuture: boolean; isPast: boolean; minutesUntil: number } {
  // A dose belongs to a specific calendar day (the day being viewed in the week
  // strip). The 2h-before/4h-after window only makes sense when that day is
  // TODAY — for any other day we short-circuit so the button state reflects
  // reality instead of comparing a past/future day's dose against "right now".
  if (forDate && forDate !== ds()) {
    if (forDate < ds()) {
      return { canMark: false, isFuture: false, isPast: true, minutesUntil: -999999 };
    }
    return { canMark: false, isFuture: true, isPast: false, minutesUntil: 999999 };
  }
  const now = new Date();
  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  const diffMinutes = (scheduled.getTime() - now.getTime()) / 60000;
  const BEFORE_WINDOW = -240; // 4 hours after
  const AFTER_WINDOW = 120;   // 2 hours before
  return {
    canMark: diffMinutes >= BEFORE_WINDOW && diffMinutes <= AFTER_WINDOW,
    isFuture: diffMinutes > AFTER_WINDOW,
    isPast: diffMinutes < BEFORE_WINDOW,
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

function Ring({ pct }: { pct: number }) {
  const R = 30, C = 2 * Math.PI * R, off = C - (pct / 100) * C;
  return (
    <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
      <Svg width={72} height={72} viewBox="0 0 72 72" style={{ position: "absolute" }}>
        <Circle cx={36} cy={36} r={R} fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth={7} />
        <Circle cx={36} cy={36} r={R} fill="none" stroke={AC} strokeWidth={7}
          strokeDasharray={`${C}`} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 36 36)" />
      </Svg>
      <Text style={{ color: TX, fontSize: 13, fontWeight: "700" }}>{pct}%</Text>
    </View>
  );
}

export default function Today() {
  const router = useRouter();
  const [date, setDate] = useState(ds());
  const [doses, setDoses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [yogaReminderTime, setYogaReminderTime] = useState<string | null>(null);
  const [yogaTipName, setYogaTipName] = useState<string | null>(null);
  const [yogaTipMeta, setYogaTipMeta] = useState<string | null>(null);
  const [adherenceMap, setAdherenceMap] = useState<Record<string, number>>({});
  const [drugFoodGuide, setDrugFoodGuide] = useState<any>(null);
  const [foodGuideOpen, setFoodGuideOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [waterLogged, setWaterLogged] = useState(0);
  const waterGoal = 2500; // in ml (10 glasses of 250ml)

  useEffect(() => {
    get<number>("water_logged_" + date).then(val => {
      setWaterLogged(val || 0);
    });
  }, [date]);

  useEffect(() => {
    api.getDrugFoodGuide().then(g => { if (g) setDrugFoodGuide(g); }).catch(() => {});
  }, [doses]);

  const addWater = async (amountMl: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTotal = Math.min(5000, waterLogged + amountMl);
    setWaterLogged(newTotal);
    await set("water_logged_" + date, newTotal);
    track("water_intake_logged", { amountMl, date, totalMl: newTotal });
  };

  const resetWater = async () => {
    setWaterLogged(0);
    await set("water_logged_" + date, 0);
  };

  const [addMed, setAddMed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleAddMedication = () => {
    const features = getFeatures();
    const uniqueMeds = new Set(doses.map((d: any) => d.medication_id)).size;
    if (uniqueMeds >= features.max_medications) {
      setShowUpgrade(true);
      return;
    }
    setAddMed(true);
  };
  const [actionSheet, setActionSheet] = useState(false);
  const [stockModal, setStockModal] = useState<{ id: string; name: string; stock: number } | null>(null);
  const [refillMed, setRefillMed] = useState<{ id: string; name: string; stock?: number } | null>(null);
  const pending = useRef<Set<string>>(new Set());
  const days = getWD(date);

  // Proactively surface a low/out-of-stock prompt once per day per medication —
  // instead of relying on the user to notice and tap the passive banner.
  useEffect(() => {
    if (!doses.length) return;
    const lows = [...new Set(doses.map((d: any) => d.medication_id))]
      .map(mid => doses.find((d: any) => d.medication_id === mid))
      .filter(Boolean)
      .map((d: any) => ({ id: d.medication_id, name: d.medication_name || d.medication?.name || "", stock: d.medication?.stock ?? 999 }))
      .filter((m: any) => m.stock !== undefined && m.stock <= 3);
    if (!lows.length) return;
    (async () => {
      for (const m of lows) {
        const key = `stock_prompt_${date}_${m.id}`;
        const already = await get<boolean>(key);
        if (!already) {
          await set(key, true);
          setStockModal(m);
          break;
        }
      }
    })();
  }, [doses, date]);

  // Load from local cache instantly — always shown even offline
  useEffect(() => {
    get<any[]>(K.doses(date)).then(d => { if (d) setDoses(d); });
    get<any>(K.profile).then(p => { if (p) setProfile(p); });
    get<number>(K.streak).then(s => { if (s !== null) setStreak(s); });
    get<any>(K.aiMsg).then(a => { if (a) setAiMsg(a); });
    get<string>("yoga_reminder_time").then(t => { if (t) setYogaReminderTime(t); }).catch(() => {});
    get<any>(K.yogaTip).then(tip => {
      if (tip?.title) setYogaTipName(tip.title);
      if (tip?.duration || tip?.level) setYogaTipMeta([tip.duration, tip.level].filter(Boolean).join(" • "));
    }).catch(() => {});
  }, [date]);

  const fetchServer = useCallback(async () => {
    try {
      // ALWAYS flush write queue first — server must receive our taken status before we fetch
      await flushQueue();
      const [d, p, a] = await Promise.all([api.listDoses(date), api.getProfile(), api.adherence(30)]);
      const serverDoses = d || [];
      // Merge with persistent local taken registry — local ALWAYS wins over server "pending"
      const merged = await mergeDoses(serverDoses, date);
      setDoses(merged);
      set(K.doses(date), merged);
      setProfile(p); setStreak(a?.streak || 0);
      set(K.profile, p); set(K.streak, a?.streak || 0);
      const map: Record<string, number> = {};
      for (const day of (a?.daily || [])) map[day.date] = day.pct;
      setAdherenceMap(map);
    } catch {
      // Offline — keep showing cached data, never clear anything
    }
  }, [date]);

  const fetchAI = useCallback(async () => {
    try {
      const r = await api.dailyMessage();
      setAiMsg(r.message);
      if (r.streak) setStreak(r.streak);
      set(K.aiMsg, r.message);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    track("app_open");
    flushQueue();
    backgroundRefresh(fetchServer);
    backgroundRefresh(fetchAI);
  }, [fetchServer, fetchAI]));

  const onRefresh = async () => { setRefreshing(true); await Promise.all([fetchServer(), fetchAI()]); setRefreshing(false); };

  // Race-condition-free dose marking
  // RULE: Taken is FINAL — once marked taken, it cannot be changed.
  // Missed/Skipped can be acknowledged but not toggled back.
  const mark = useCallback(async (id: string, cur: string, action?: string) => {
    if (pending.current.has(id)) return;
    // If already taken — do nothing. Taken is permanent.
    if (cur === "taken") return;
    // Determine next status
    const nx = action || (cur === "pending" ? "taken" : "missed");
    // Always use device local time — not UTC
    const takenAt = nx === "taken" ? new Date().toISOString() : undefined;
    pending.current.add(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track(nx === "taken" ? "dose_taken" : nx === "missed" ? "dose_missed" : "dose_skipped", { date });
    // 1. Update UI immediately
    setDoses(prev => {
      const u = prev.map(d => d.id === id ? { ...d, status: nx, taken_at: takenAt } : d);
      set(K.doses(date), u);
      return u;
    });
    // 2. Persist taken status permanently in AsyncStorage
    //    This survives server data overwrites — even if offline for days
    if (nx === "taken" && takenAt) {
      recordTaken(id, date, takenAt);
    }
    // 3. Add to write queue first (ensures delivery if offline)
    const queueId = await enqueueWrite("doseStatus", { id, status: nx, taken_at: takenAt });
    // 4. Try direct API call immediately if online
    api.setDoseStatus(id, nx, takenAt)
      .then(async () => {
        // Success — remove from queue so it doesn't send twice
        if (queueId) {
          const { dequeue } = await import("@/src/lib/store");
          await dequeue(queueId);
        }
        pending.current.delete(id);
      })
      .catch(() => {
        // Offline — stays in queue, will sync when reconnected
        pending.current.delete(id);
      });
    resyncReminders().catch(() => {});
  }, [date]);

  const markComplete = async (medId: string) => {
    try {
      const pendingForMed = doses.filter((d: any) => d.medication_id === medId && d.status === "pending");
      await Promise.all(pendingForMed.map((d: any) => api.setDoseStatus(d.id, "skipped")));
      await api.deleteMedication(medId);
      track("medication_marked_complete", { reason: "out_of_stock" });
      // Drop this medication's doses from state immediately instead of waiting
      // on the background refresh round-trip — otherwise the out-of-stock
      // banner/modal looks "stuck" for a beat (or longer, on a slow network)
      // right after the user taps Treatment complete.
      setDoses(prev => {
        const u = prev.filter((d: any) => d.medication_id !== medId);
        set(K.doses(date), u);
        return u;
      });
      await backgroundRefresh(fetchServer);
    } catch {
      Alert.alert("Could not update", "Please check your connection and try again.");
    }
  };

  const taken = doses.filter(d => d.status === "taken").length,
    total = doses.length,
    pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const next = doses.filter(d => d.status === "pending").sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))[0];
  const secs: Record<string, any[]> = {};
  for (const d of doses) { const sc = gs(d.scheduled_time); if (!secs[sc]) secs[sc] = []; secs[sc].push(d); }

  const calDayColor = (dayDate: string) => {
    const pct = adherenceMap[dayDate];
    if (pct === undefined) return BD;
    if (pct >= 80) return "rgba(74,222,128,0.22)";
    if (pct >= 50) return "rgba(229,178,133,0.22)";
    return "rgba(229,133,133,0.22)";
  };
  const calDayTextColor = (dayDate: string) => {
    const pct = adherenceMap[dayDate];
    if (pct === undefined) return TX;
    if (pct >= 80) return "#4ade80";
    if (pct >= 50) return "#e5b285";
    return "#e58585";
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}>
        <Text style={s.appNm}>PillCare</Text>
        <View style={s.hdrR}>
          <TouchableOpacity style={s.iBtn} onPress={() => setCalOpen(true)}><Ionicons name="calendar-outline" size={15} color={TX} /></TouchableOpacity>
          <View style={s.sTag}><Ionicons name="flame" size={13} color={A3} /><Text style={s.sTx}>{streak}</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AC} />}>

        {/* Overview card */}
        <View style={s.ov}>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={s.ovTag}><Text style={s.ovTagTx}>{profile?.nickname?.toUpperCase() || "YOU"}</Text></View>
            <Text style={s.ovTitle}>Your consistency{"\n"}is your strength.</Text>
            <Text style={s.ovSub}>{total === 0 ? "Add your first medication." : taken === total ? "All done for today!" : `${total - taken} medication${total - taken === 1 ? "" : "s"} left.`}</Text>
            <View style={{ gap: 4, marginTop: 4 }}>
              {next && <View style={s.mRow}><Ionicons name="time-outline" size={12} color={A3} /><Text style={s.mTx}>Next: <Text style={{ color: TX }}>{next.medication?.name}</Text> at {next.scheduled_time}</Text></View>}
              <View style={s.mRow}><Ionicons name="flame" size={12} color={A3} /><Text style={s.mTx}>Streak: <Text style={{ color: TX, fontWeight: "700" }}>{streak} Days</Text></Text></View>
            </View>
          </View>
          <Ring pct={pct} />
        </View>

        {/* Week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {days.map(d => {
            const a = d.iso === date;
            return (
              <TouchableOpacity key={d.iso} onPress={() => setDate(d.iso)} style={[s.pill, a && s.pillOn]}>
                <Text style={[s.pL, a && s.pLOn]}>{d.l}</Text>
                <Text style={[s.pN, a && s.pNOn]}>{d.n}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Water Intake & Hydration Tracker Card */}
        <View style={[s.aiCard, { borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(14,165,233,0.06)", marginTop: 10 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={s.aiH}>
              <Ionicons name="water" size={13} color="#38bdf8" />
              <Text style={[s.aiK, { color: "#38bdf8" }]}>HYDRATION & WATER TRACKER</Text>
            </View>
            <TouchableOpacity onPress={resetWater}>
              <Text style={{ fontSize: 10, color: TM, fontWeight: "600" }}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: TX }}>
                {waterLogged} <Text style={{ fontSize: 12, fontWeight: "500", color: TM }}>/ {waterGoal} mL</Text>
              </Text>
              <Text style={{ fontSize: 11, color: "#38bdf8", fontWeight: "600" }}>
                {Math.round(waterLogged / 250)} of {Math.round(waterGoal / 250)} glasses consumed today
              </Text>
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="water" size={22} color="#38bdf8" />
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
            <View style={{ height: "100%", width: `${Math.min(100, Math.round((waterLogged / waterGoal) * 100))}%`, backgroundColor: "#38bdf8", borderRadius: 3 }} />
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "rgba(56,189,248,0.15)", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
              onPress={() => addWater(250)}>
              <Ionicons name="add-circle-outline" size={14} color="#38bdf8" />
              <Text style={{ fontSize: 12, color: "#38bdf8", fontWeight: "700" }}>+ Glass (250ml)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "rgba(56,189,248,0.22)", borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
              onPress={() => addWater(500)}>
              <Ionicons name="add" size={14} color="#38bdf8" />
              <Text style={{ fontSize: 12, color: "#38bdf8", fontWeight: "700" }}>+ Bottle (500ml)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Insight */}
        {aiMsg && (
          <View style={s.aiCard}>
            <View style={s.aiH}><Ionicons name="sparkles" size={10} color={A3} /><Text style={s.aiK}>AI INSIGHT</Text></View>
            <Text style={s.aiTx}>{aiMsg}</Text>
          </View>
        )}

        {/* AI Recommended Yoga Therapy Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[s.aiCard, { borderColor: "rgba(168,85,247,0.3)", backgroundColor: "rgba(22,25,38,0.9)" }]}
          onPress={() => router.push("/(tabs)/treatment?openYoga=1")}>
          <View style={s.aiH}>
            <Ionicons name="leaf-outline" size={12} color="#A855F7" />
            <Text style={[s.aiK, { color: "#A855F7" }]}>
              AI YOGA THERAPY — {(() => {
                if (!yogaReminderTime) return "08:00 AM daily";
                const [h, m] = yogaReminderTime.split(":").map(Number);
                if (isNaN(h) || isNaN(m)) return `${yogaReminderTime} daily`;
                const period = h >= 12 ? "PM" : "AM";
                const hour12 = h % 12 === 0 ? 12 : h % 12;
                return `${hour12}:${String(m).padStart(2, "0")} ${period} daily`;
              })()}
            </Text>
          </View>
          <Text style={[s.aiTx, { fontWeight: "700", color: TX, marginBottom: 2 }]} numberOfLines={2}>
            {yogaTipName || "Anulom Vilom & Pawanmuktasana Flow"}
          </Text>
          <Text style={{ fontSize: 11, color: TM, marginBottom: 8 }}>
            {yogaTipMeta || "12 min • Verified Ministry of AYUSH & Swami Ramdev"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "rgba(168,85,247,0.18)", borderRadius: 8, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "rgba(168,85,247,0.3)" }}
              onPress={() => router.push("/(tabs)/treatment?openYoga=1")}>
              <Ionicons name="play-circle-outline" size={14} color="#A855F7" />
              <Text style={{ fontSize: 12, color: "#A855F7", fontWeight: "700" }}>View routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "rgba(74,222,128,0.12)", borderRadius: 8, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" }}
              onPress={async (e) => {
                e.stopPropagation?.();
                const { set, get, K } = await import("@/src/lib/store");
                await set("yoga_done_" + date, [1, 2, 3, 4, 5]);
                const historyCache = (await get<any[]>(K.history)) || [];
                let dayItem = historyCache.find((item: any) => item.date === date);
                if (!dayItem) {
                  dayItem = { date, total: 0, taken: 0, entries: [] };
                  historyCache.unshift(dayItem);
                }
                const newEntry = {
                  id: `yoga_session_${Date.now()}`,
                  name: "Yoga: Daily Therapy Session",
                  generic_name: "AI Yoga Therapy",
                  dosage: "",
                  unit: "",
                  time: yogaReminderTime || "08:00",
                  status: "yoga_completed",
                  note: "Completed full daily routine"
                };
                if (!dayItem.entries.some((entry: any) => entry.name === newEntry.name)) {
                  dayItem.entries.push(newEntry);
                }
                await set(K.history, [...historyCache]);
                const { api } = await import("@/src/lib/api");
                api.yogaComplete(1, "Daily Yoga Therapy Flow", "https://www.youtube.com/watch?v=QPjwawKxuLw").catch(() => {});
                track("yoga_done");
                Alert.alert("Yoga Completed", "Great job! Daily yoga logged for today.");
              }}>
              <Text style={{ fontSize: 12, color: "#4ade80", fontWeight: "700" }}>Mark done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Drug & Food Clinical Guide Card on Today screen */}
        {drugFoodGuide && drugFoodGuide.has_medications && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[s.aiCard, { borderColor: "rgba(74,222,128,0.3)", backgroundColor: "rgba(74,222,128,0.05)" }]}
            onPress={() => setFoodGuideOpen(true)}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={s.aiH}>
                <Ionicons name="restaurant-outline" size={12} color="#4ade80" />
                <Text style={[s.aiK, { color: "#4ade80" }]}>DRUG & FOOD CLINICAL GUIDE</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(74,222,128,0.18)" }}>
                <Text style={{ fontSize: 9, color: "#4ade80", fontWeight: "700" }}>VIEW GUIDE</Text>
              </View>
            </View>
            <Text style={[s.aiTx, { fontWeight: "700", color: TX, marginTop: 4, marginBottom: 2 }]}>
              Food Timing & Interaction Advice
            </Text>
            <Text style={{ fontSize: 11, color: TM }}>
              {drugFoodGuide.scanned_medications} medicines scanned • Avoid food interactions & improve absorption
            </Text>
          </TouchableOpacity>
        )}

        {/* Dose sections */}
        {total === 0 ? (
          <View style={s.empty}>
            <View style={s.emI}><Ionicons name="medical-outline" size={26} color={AC} /></View>
            <Text style={s.emT}>No medications yet</Text>
            <Text style={s.emS}>Tap + to add your first medication</Text>
          </View>
        ) : ["morning", "afternoon", "evening", "night"].map(sec => {
          const items = secs[sec]; if (!items?.length) return null;
          return (
            <View key={sec} style={{ gap: 8, marginBottom: 6 }}>
              <View style={s.sH}><Ionicons name={SI[sec]} size={12} color={A3} /><Text style={s.sL}>{sec.toUpperCase()} • {items[0]?.scheduled_time}</Text></View>
              {items.map(dose => {
                const m = dose.medication || {}, st = dose.status || "pending";
                const tk = st === "taken", sk = st === "skipped", ms = st === "missed";
                const guide = drugFoodGuide?.guides?.find((g: any) =>
                  g.medication?.toLowerCase().includes(m.name?.toLowerCase()) ||
                  m.name?.toLowerCase().includes(g.medication?.toLowerCase())
                );
                return (
                  <View key={dose.id} style={[s.dc, (tk) && s.dcD]}>
                    <View style={[s.dI, tk && { backgroundColor: "rgba(145,132,217,0.08)" }]}>
                      <Ionicons name="medical-outline" size={16} color={tk ? TM : A3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dN, (tk) && { color: TM }]}>{m.name || "Unknown"}</Text>
                      {m.generic_name ? <Text style={[s.dM, { color: A3, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                      <Text style={s.dM}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
                      {typeof m.stock === "number" ? (<Text style={[s.dM, { color: m.stock <= 0 ? "#f87171" : m.stock < 3 ? "#fbbf24" : TM, marginTop: 1 }]}>{m.stock <= 0 ? "Out of stock" : `${m.stock} left`}</Text>) : null}
                      {guide?.dos?.[0] && (
                        <View style={{ marginTop: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(74,222,128,0.08)", borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
                          <Ionicons name="restaurant-outline" size={10} color="#4ade80" />
                          <Text style={{ fontSize: 9, color: "#4ade80", fontWeight: "600" }}>{guide.dos[0]}</Text>
                        </View>
                      )}
                    </View>
                    {/* Time-locked dose actions */}
                    {(() => {
                      const win = getDoseWindow(dose.scheduled_time, date);
                      if (tk) return (
                        // TAKEN = permanent, non-tappable
                        <View style={[s.bTk, { opacity: 1 }]}>
                          <Ionicons name="checkmark-circle" size={13} color={A3} style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: A3 }}>
                            {"Taken" + (dose.taken_at ? " " + new Date(dose.taken_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) : "")}
                          </Text>
                        </View>
                      );
                      if (ms || sk) return (
                        <View style={s.bSk}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#e58585" }}>{ms ? "Missed" : "Skipped"}</Text>
                        </View>
                      );
                      if (win.isFuture) return (
                        <View style={s.bLock}>
                          <Ionicons name="lock-closed" size={10} color={TM} />
                          <Text style={{ fontSize: 10, color: TM }}>{formatTimeUntil(win.minutesUntil)}</Text>
                        </View>
                      );
                      if (win.isPast) return (
                        <TouchableOpacity style={s.bMs} onPress={() => mark(dose.id, st, "missed")}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#e58585" }}>Mark Missed</Text>
                        </TouchableOpacity>
                      );
                      // Within window
                      return (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <TouchableOpacity style={s.bP} onPress={() => mark(dose.id, st, "taken")}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Take</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.bMs} onPress={() => mark(dose.id, st, "missed")}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#e58585" }}>Missed</Text>
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

      {/* Low stock & out of stock warnings */}
      {doses.length > 0 && (() => {
      const lowStock = [...new Set(doses.map((d: any) => d.medication_id))]
      .map(mid => doses.find((d: any) => d.medication_id === mid))
      .filter(Boolean)
      .map((d: any) => ({ id: d.medication_id, name: d.medication_name || d.medication?.name || "", stock: d.medication?.stock ?? 999 }))
      .filter(m => m.stock !== undefined && m.stock <= 3);
      if (!lowStock.length) return null;
      const onStockPress = (m: { id: string; name: string; stock: number }) => {
        setStockModal(m);
      };
      return (
        <View style={{ marginHorizontal: 14, marginBottom: 10, gap: 6 }}>
          {lowStock.map((m, i) => (
          <TouchableOpacity key={i} style={{ backgroundColor: m.stock <= 0 ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: m.stock <= 0 ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)" }}
            onPress={() => onStockPress(m)}>
            <Ionicons name={m.stock <= 0 ? "alert-circle" : "warning"} size={16} color={m.stock <= 0 ? "#f87171" : "#fbbf24"} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: m.stock <= 0 ? "#f87171" : "#fbbf24" }}>
                {m.stock <= 0 ? `${m.name} is out of stock` : `${m.name} — only ${m.stock} left`}
              </Text>
              <Text style={{ fontSize: 11, color: TM, marginTop: 1 }}>{m.stock <= 0 ? "Tap for options" : "Tap to find nearest pharmacy"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={13} color={TM} />
          </TouchableOpacity>
          ))}
        </View>
        );
    })()}
      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setActionSheet(true)}><Ionicons name="add" size={24} color={BG} /></TouchableOpacity>

      {/* Calendar modal with green/red coloring */}
      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => setCalOpen(false)}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setCalOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={s.cal}>
            <View style={s.hand} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 4 }}>
              <Text style={s.calT}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</Text>
              <TouchableOpacity onPress={() => setCalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ade80" }} /><Text style={{ fontSize: 9, color: TM }}>All taken</Text></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#e5b285" }} /><Text style={{ fontSize: 9, color: TM }}>Partial</Text></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#e58585" }} /><Text style={{ fontSize: 9, color: TM }}>Missed</Text></View>
            </View>
            <View style={s.calG}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (<Text key={d} style={s.calH}>{d}</Text>))}
              {Array.from({ length: 31 }, (_, i) => {
                const dayNum = i + 1;
                const now = new Date();
                const dayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isSelected = dayDate === date;
                const bgColor = isSelected ? AC : calDayColor(dayDate);
                const textColor = isSelected ? "#fff" : calDayTextColor(dayDate);
                return (
                  <TouchableOpacity key={i} style={[s.calD, { backgroundColor: bgColor, borderWidth: isSelected ? 1.5 : 0, borderColor: AC }]}
                    onPress={() => { setDate(dayDate); setCalOpen(false); }}>
                    <Text style={[s.calDT, { color: textColor }]}>{dayNum}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.dc}>
              <View style={[s.dI, { borderRadius: 19 }]}><Ionicons name="flame" size={19} color={A3} /></View>
              <View><Text style={s.dN}>{streak} day streak</Text><Text style={s.dM}>Keep it going!</Text></View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Action sheet — same as Treatment tab */}
      <Modal visible={actionSheet} transparent animationType="slide" onRequestClose={() => setActionSheet(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setActionSheet(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: "#3f424d", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: TX }}>What would you like to do?</Text>
              <TouchableOpacity onPress={() => setActionSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            {[
              { icon: "medical-outline", title: "Add Medication", body: "Add a new medication to your routine", fn: () => { setActionSheet(false); handleAddMedication(); } },
              { icon: "calendar-outline", title: "Book Appointment", body: "Schedule a doctor appointment", fn: () => { setActionSheet(false); router.push("/appointments"); } },
              { icon: "leaf-outline", title: "AI Yoga Recommendation", body: "View your personalised yoga routine", fn: () => { setActionSheet(false); router.push("/(tabs)/treatment"); } },
              { icon: "storefront-outline", title: "Nearby Pharmacy", body: "Find medical stores and diagnostic labs", fn: () => { setActionSheet(false); router.push("/nearby"); } },
            ].map(o => (
              <TouchableOpacity key={o.title} onPress={o.fn}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#232532", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "rgba(233,233,237,0.1)" }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(145,132,217,0.14)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={o.icon as any} size={17} color={A3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: TX }}>{o.title}</Text>
                  <Text style={{ fontSize: 10, color: TM, marginTop: 1 }}>{o.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={TM} />
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Out of stock modal */}
      <Modal visible={!!stockModal} transparent animationType="slide" onRequestClose={() => setStockModal(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setStockModal(null)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: "#3f424d", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name={(stockModal?.stock ?? 0) <= 0 ? "alert-circle" : "warning"} size={22} color={(stockModal?.stock ?? 0) <= 0 ? "#f87171" : "#fbbf24"} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: TX, flex: 1 }}>{(stockModal?.stock ?? 0) <= 0 ? `${stockModal?.name} is out of stock` : `${stockModal?.name} — only ${stockModal?.stock} left`}</Text>
              </View>
              <TouchableOpacity onPress={() => setStockModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: TM, lineHeight: 17 }}>{(stockModal?.stock ?? 0) <= 0 ? "You have 0 pills remaining. Refill your stock to continue reminders, or mark this treatment course as complete." : "Running low on medication — refill your stock or find a nearby pharmacy before running out."}</Text>

            {/* If stock > 0 and pending dose exists, allow marking taken */}
            {(() => {
              if ((stockModal?.stock ?? 0) <= 0) return null;
              const pendingDose = doses.find((d: any) => d.medication_id === stockModal?.id && d.status === "pending");
              if (!pendingDose) return null;
              return (
                <TouchableOpacity onPress={() => { mark(pendingDose.id, "pending", "taken"); setStockModal(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "rgba(74,222,128,0.25)" }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#4ade80" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#4ade80", flex: 1 }}>Mark today's dose as taken</Text>
                </TouchableOpacity>
              );
            })()}

            {/* Custom Refill Stock Option */}
            <TouchableOpacity onPress={() => {
              const med = stockModal;
              setStockModal(null);
              if (med) setRefillMed(med);
            }} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)" }}>
              <Ionicons name="cube-outline" size={18} color="#38bdf8" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#38bdf8", flex: 1 }}>Refill stock (Select quantity)</Text>
              <Ionicons name="chevron-forward" size={14} color="#38bdf8" />
            </TouchableOpacity>

            {/* Find Pharmacy Option */}
            <TouchableOpacity onPress={() => { setStockModal(null); router.push("/nearby"); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#232532", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "rgba(233,233,237,0.1)" }}>
              <Ionicons name="storefront-outline" size={18} color={A3} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: TX, flex: 1 }}>Find nearby pharmacy</Text>
              <Ionicons name="chevron-forward" size={14} color={TM} />
            </TouchableOpacity>

            {/* Treatment Course Complete Option */}
            <TouchableOpacity onPress={() => {
              const id = stockModal?.id;
              const name = stockModal?.name;
              Alert.alert("Mark Course Complete?", `Mark treatment for ${name || "this medication"} as completed? It will be archived in your course history.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Mark Complete", style: "default", onPress: async () => {
                  setStockModal(null);
                  if (id) {
                    setDoses(prev => prev.filter(d => d.medication_id !== id));
                    try { await api.completeMedication(id); } catch {}
                    await fetchServer();
                  }
                }}
              ]);
            }} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" }}>
              <Ionicons name="checkmark-done-circle-outline" size={18} color="#4ade80" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#4ade80", flex: 1 }}>Course completed (Archive)</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStockModal(null)} style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: TM }}>Remind me later</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Drug-Food Modal Guide */}
      <Modal visible={foodGuideOpen} transparent animationType="slide" onRequestClose={() => setFoodGuideOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setFoodGuideOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: "#1c1e2d", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%", gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="restaurant-outline" size={20} color="#4ade80" />
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>Drug-Food Do's & Don'ts Guide</Text>
              </View>
              <TouchableOpacity onPress={() => setFoodGuideOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={TX} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* DO's List */}
              <View style={{ backgroundColor: "rgba(74,222,128,0.08)", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#4ade80" }}>RECOMMENDED DO'S</Text>
                </View>
                {(drugFoodGuide?.dos || []).map((doItem: string, idx: number) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Text style={{ color: "#4ade80", fontWeight: "700" }}>•</Text>
                    <Text style={{ fontSize: 12, color: TX, flex: 1, lineHeight: 17 }}>{doItem}</Text>
                  </View>
                ))}
              </View>

              {/* DON'TS List */}
              <View style={{ backgroundColor: "rgba(239,68,68,0.08)", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#ef4444" }}>CRITICAL DON'TS</Text>
                </View>
                {(drugFoodGuide?.donts || []).map((dontItem: string, idx: number) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>•</Text>
                    <Text style={{ fontSize: 12, color: TX, flex: 1, lineHeight: 17 }}>{dontItem}</Text>
                  </View>
                ))}
              </View>

              {/* Per-Medication Guides */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: A3, marginTop: 4 }}>Medication-Specific Guidance:</Text>
              {(drugFoodGuide?.guides || []).map((g: any, idx: number) => (
                <View key={idx} style={{ backgroundColor: "#252837", padding: 12, borderRadius: 10, gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: TX }}>{g.medication} <Text style={{ fontSize: 11, color: A3, fontWeight: "500" }}>({g.category})</Text></Text>
                  {g.dos?.map((d: string, i: number) => (
                    <Text key={i} style={{ fontSize: 11, color: "#4ade80" }}>✓ {d}</Text>
                  ))}
                  {g.donts?.map((d: string, i: number) => (
                    <Text key={i} style={{ fontSize: 11, color: "#ef4444" }}>✗ {d}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Medication limit reached"
        description={`Free plan supports up to ${getFeatures().max_medications} medications. Upgrade to Pro Dharma for unlimited.`}
      />
      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={() => { setAddMed(false); backgroundRefresh(fetchServer); resyncReminders().catch(() => {}); }} />
      <RefillModal visible={!!refillMed} medication={refillMed} onClose={() => setRefillMed(null)} onRefilled={async () => { await fetchServer(); }} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  appNm: { fontSize: 16, fontWeight: "600", color: TX }, hdrR: { flexDirection: "row", alignItems: "center", gap: 7 },
  iBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(233,233,237,0.15)", alignItems: "center", justifyContent: "center" },
  sTag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: AB, borderWidth: 1, borderColor: "rgba(145,132,217,0.25)" },
  sTx: { fontSize: 13, fontWeight: "600", color: A3 }, body: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },
  ov: { backgroundColor: SF, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: BD },
  ovTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: AB, marginBottom: 4 },
  ovTagTx: { fontSize: 9, fontWeight: "700", color: A3, letterSpacing: 1 }, ovTitle: { fontSize: 19, fontWeight: "700", color: TX, lineHeight: 25, letterSpacing: -.4 },
  ovSub: { fontSize: 12, color: TM }, mRow: { flexDirection: "row", alignItems: "center", gap: 5 }, mTx: { fontSize: 11, color: TM },
  strip: { paddingVertical: 2, gap: 6 }, pill: { width: 46, height: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: BD },
  pillOn: { backgroundColor: AB, borderColor: AC }, pL: { fontSize: 9, letterSpacing: .6, textTransform: "uppercase", color: TD, fontWeight: "700" }, pLOn: { color: A3 },
  pN: { fontSize: 17, fontWeight: "700", color: TX }, pNOn: { color: A3 },
  aiCard: { backgroundColor: "rgba(145,132,217,0.07)", borderRadius: 14, padding: 13, gap: 5, borderWidth: 1, borderColor: "rgba(145,132,217,0.22)" },
  aiH: { flexDirection: "row", alignItems: "center", gap: 4 }, aiK: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: A3, fontWeight: "700" },
  aiTx: { fontSize: 12, color: TM, lineHeight: 17 }, sH: { flexDirection: "row", alignItems: "center", gap: 5 }, sL: { fontSize: 10, letterSpacing: .7, color: TM, fontWeight: "600" },
  dc: { backgroundColor: SF, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: BD },
  dcD: { backgroundColor: "rgba(35,37,50,0.5)", borderColor: "rgba(233,233,237,0.06)" },
  dI: { width: 34, height: 34, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  dN: { fontSize: 13, fontWeight: "600", color: TX }, dM: { fontSize: 10, color: TM, marginTop: 2 },
  bP: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: AC, alignItems: "center", justifyContent: "center" },
  bTk: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(145,132,217,0.12)", borderWidth: 1, borderColor: "rgba(145,132,217,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row" },
  bSk: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(229,133,133,0.12)", alignItems: "center", justifyContent: "center" },
  bMs: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(229,133,133,0.1)", borderWidth: 1, borderColor: "rgba(229,133,133,0.2)", alignItems: "center", justifyContent: "center" },
  bLock: { height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "rgba(233,233,237,0.06)", borderWidth: 1, borderColor: "rgba(233,233,237,0.1)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  empty: { backgroundColor: SF, borderRadius: 18, padding: 36, alignItems: "center", gap: 8, borderWidth: 1, borderColor: BD },
  emI: { width: 52, height: 52, borderRadius: 26, backgroundColor: AB, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emT: { fontSize: 15, fontWeight: "700", color: TX }, emS: { fontSize: 12, color: TM, textAlign: "center" },
  fab: { position: "absolute", right: 18, bottom: 90, width: 52, height: 52, borderRadius: 26, backgroundColor: AC, alignItems: "center", justifyContent: "center", elevation: 6 },
  ovl: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  cal: { backgroundColor: N8, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, gap: 10 },
  hand: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.25)", alignSelf: "center", marginBottom: 4 },
  calT: { fontSize: 15, fontWeight: "700", color: TX, textAlign: "center" },
  calG: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  calH: { width: "14.28%", textAlign: "center", fontSize: 9, color: TM, fontWeight: "600", paddingBottom: 4 },
  calD: { width: "14.28%", aspectRatio: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  calDT: { fontSize: 12, color: TX },
});
