import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { getFeatures } from "@/src/lib/features";
import { track } from "@/src/lib/analytics";
import { api } from "@/src/lib/api";
import { resyncReminders } from "@/src/lib/notifications";
import { get, set, K } from "@/src/lib/store";
import { flushQueue, backgroundRefresh, recordTaken, mergeDoses, enqueueWrite } from "@/src/lib/sync";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", TD = "rgba(233,233,237,0.3)",
  AC = "#9184d9", A3 = "#a7a1db", AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

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
function getDoseWindow(scheduledTime: string): { canMark: boolean; isFuture: boolean; isPast: boolean; minutesUntil: number } {
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
        <Circle cx={36} cy={36} r={R} fill="none" stroke="rgba(145,132,217,0.18)" strokeWidth={7} />
        <Circle cx={36} cy={36} r={R} fill="none" stroke={AC} strokeWidth={7}
          strokeDasharray={`${C}`} strokeDashoffset={off} strokeLinecap="round" rotation={-90} origin="36,36" />
      </Svg>
      <Text style={{ color: TX, fontSize: 13, fontWeight: "700" }}>{pct}%</Text>
    </View>
  );
}

export default function Today() {
  const [date, setDate] = useState(ds());
  const [doses, setDoses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [yogaReminderTime, setYogaReminderTime] = useState<string | null>(null);
  const [yogaTipName, setYogaTipName] = useState<string | null>(null);
  const [yogaTipMeta, setYogaTipMeta] = useState<string | null>(null);
  const [adherenceMap, setAdherenceMap] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
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
  const pending = useRef<Set<string>>(new Set());
  const days = getWD(date);

  // Load from local cache instantly — always shown even offline
  useEffect(() => {
    get<any[]>(K.doses(date)).then(d => { if (d) setDoses(d); });
    get<any>(K.profile).then(p => { if (p) setProfile(p); });
    get<number>(K.streak).then(s => { if (s !== null) setStreak(s); });
    get<any>(K.aiMsg).then(a => { if (a) setAiMsg(a); });
    get<string>("yoga_reminder_time").then(t => { if (t) setYogaReminderTime(t);
    get<any>(K.yogaTip).then(tip => {
      if (tip?.title) setYogaTipName(tip.title);
      if (tip?.duration || tip?.level) setYogaTipMeta([tip.duration, tip.level].filter(Boolean).join(" • "));
    }).catch(() => {}); });
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
    const takenAt = nx === "taken"
      ? new Date().toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).replace(" ", "T")
      : undefined;
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
            <Text style={s.ovSub}>{total === 0 ? "Add your first medication." : taken === total ? "All done for today! 🎉" : `${total - taken} medication${total - taken === 1 ? "" : "s"} left.`}</Text>
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

        {/* AI Insight */}
        {aiMsg && (
          <View style={s.aiCard}>
            <View style={s.aiH}><Ionicons name="sparkles" size={10} color={A3} /><Text style={s.aiK}>AI INSIGHT</Text></View>
            <Text style={s.aiTx}>{aiMsg}</Text>
          </View>
        )}

        {yogaReminderTime && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[s.aiCard, { borderColor: "rgba(145,132,217,0.3)" }]}
            onPress={() => router.push("/(tabs)/treatment")}>
            <View style={s.aiH}>
              <Ionicons name="leaf-outline" size={10} color={A3} />
              <Text style={s.aiK}>YOGA REMINDER — {yogaReminderTime} daily</Text>
            </View>
            {yogaTipName ? (
              <>
                <Text style={[s.aiTx, { fontWeight: "700", color: TX, marginBottom: 2 }]} numberOfLines={2}>{yogaTipName}</Text>
                {yogaTipMeta ? <Text style={{ fontSize: 11, color: TM, marginBottom: 8 }}>{yogaTipMeta}</Text> : null}
              </>
            ) : (
              <Text style={s.aiTx}>Your AI recommended yoga routine is ready.</Text>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "rgba(145,132,217,0.15)", borderRadius: 8, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
                onPress={() => router.push("/(tabs)/treatment")}>
                <Ionicons name="play-circle-outline" size={14} color={A3} />
                <Text style={{ fontSize: 12, color: A3, fontWeight: "700" }}>View yoga routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
                onPress={async (e) => {
                  e.stopPropagation?.();
                  const { set } = await import("@/src/lib/store");
                  await set("yoga_done_" + date, true);
                  setYogaReminderTime(null);
                  track("yoga_done");
                }}>
                <Text style={{ fontSize: 12, color: "#4ade80", fontWeight: "700" }}>Mark done</Text>
              </TouchableOpacity>
            </View>
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
                return (
                  <View key={dose.id} style={[s.dc, (tk) && s.dcD]}>
                    <View style={[s.dI, tk && { backgroundColor: "rgba(145,132,217,0.08)" }]}>
                      <Ionicons name="medical-outline" size={16} color={tk ? TM : A3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dN, (tk) && { color: TM }]}>{m.name || "Unknown"}</Text>
                      {m.generic_name ? <Text style={[s.dM, { color: A3, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                      <Text style={s.dM}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
                    </View>
                    {/* Time-locked dose actions */}
                    {(() => {
                      const win = getDoseWindow(dose.scheduled_time);
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
          .map((d: any) => ({ name: d.medication_name || d.medication?.name || "", stock: d.medication?.stock ?? 999 }))
          .filter(m => m.stock !== undefined && m.stock <= 3);
        if (!lowStock.length) return null;
        return (
          <View style={{ marginHorizontal: 14, marginBottom: 10, gap: 6 }}>
            {lowStock.map((m, i) => (
              <TouchableOpacity key={i} style={{ backgroundColor: m.stock <= 0 ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: m.stock <= 0 ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)" }}
                onPress={() => router.push("/nearby")}>
                <Ionicons name={m.stock <= 0 ? "alert-circle" : "warning"} size={16} color={m.stock <= 0 ? "#f87171" : "#fbbf24"} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: m.stock <= 0 ? "#f87171" : "#fbbf24" }}>
                    {m.stock <= 0 ? `${m.name} is out of stock` : `${m.name} — only ${m.stock} left`}
                  </Text>
                  <Text style={{ fontSize: 11, color: TM, marginTop: 1 }}>Tap to find nearest pharmacy</Text>
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
          <View style={s.cal}>
            <View style={s.hand} />
            <Text style={s.calT}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</Text>
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action sheet — same as Treatment tab */}
      <Modal visible={actionSheet} transparent animationType="slide" onRequestClose={() => setActionSheet(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setActionSheet(false)}>
          <View style={{ backgroundColor: "#3f424d", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: TX }}>What would you like to do?</Text>
            {[
              { icon: "medical-outline", title: "Add Medication", body: "Add a new medication to your routine", fn: () => { setActionSheet(false); handleAddMedication(); } },
              { icon: "calendar-outline", title: "Book Appointment", body: "Schedule a doctor appointment", fn: () => { setActionSheet(false); router.push("/appointments"); } },
              { icon: "pulse-outline", title: "Log Measurement", body: "Blood pressure, glucose, weight...", fn: () => { setActionSheet(false); router.push("/(tabs)/treatment"); } },
              { icon: "body-outline", title: "Log Activity", body: "Steps, exercise, walking...", fn: () => { setActionSheet(false); router.push("/(tabs)/treatment"); } },
              { icon: "heart-outline", title: "Log Mood", body: "Track how you are feeling today", fn: () => { setActionSheet(false); router.push("/(tabs)/treatment"); } },
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
          </View>
        </TouchableOpacity>
      </Modal>

      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Medication limit reached"
        description={`Free plan supports up to ${getFeatures().max_medications} medications. Upgrade to Premium for unlimited.`}
      />
      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={() => { setAddMed(false); backgroundRefresh(fetchServer); resyncReminders().catch(() => {}); }} />
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
