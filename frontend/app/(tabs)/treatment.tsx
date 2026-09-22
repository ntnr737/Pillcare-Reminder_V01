import { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Linking, Alert, Platform, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { RefillModal } from "@/src/components/RefillModal";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";
import { resyncReminders, YOGA_CATEGORY } from "@/src/lib/notifications";
import { get, set, K, logCourseCompleted } from "@/src/lib/store";
import { backgroundRefresh } from "@/src/lib/sync";
import { getFeatures } from "@/src/lib/features";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";
import { VideoPlayerModal } from "@/src/components/VideoPlayerModal";
import { DrugFoodGuideModal } from "@/src/components/DrugFoodGuideModal";
import { ActionSheetModal } from "@/src/components/ActionSheetModal";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";

const BG = "#0B0D14", SF = "#161926", N8 = "#2A2E42", TX = "#F9FAFB",
  TM = "rgba(249, 250, 251, 0.65)", AC = "#6366F1", A3 = "#818CF8",
  AB = "rgba(139, 92, 246, 0.18)", BD = "rgba(255, 255, 255, 0.08)",
  REFILL = "#06B6D4", SUCCESS = "#10B981";
const TABS = ["Medications", "Measurements", "Activities", "Mood"];
const ME = ["", "😟", "😔", "😐", "😊", "😄"];
const MOOD_LABELS = ["", "Very Low", "Low", "Neutral", "Good", "Great"];
const MC = ["", "#e58585", "#e5b285", "#a7a1db", "#85c1e5", "#85e5a5"];

const DEFAULT_MEASUREMENTS = [
  { key: "blood_pressure", label: "Blood Pressure", unit: "mmHg", units: ["mmHg"], composite: ["Systolic (e.g. 120)", "Diastolic (e.g. 80)"] },
  { key: "blood_glucose", label: "Blood Glucose", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", units: ["bpm"] },
  { key: "weight", label: "Weight", unit: "kg", units: ["kg", "lbs"] },
  { key: "height", label: "Height", unit: "cm", units: ["cm", "ft/in"] },
  { key: "body_temp", label: "Body Temperature", unit: "°C", units: ["°C", "°F"] },
  { key: "spo2", label: "Oxygen (SpO₂)", unit: "%", units: ["%"] },
  { key: "cholesterol_total", label: "Total Cholesterol", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "cholesterol_ldl", label: "LDL Cholesterol", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "cholesterol_hdl", label: "HDL Cholesterol", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "triglycerides", label: "Triglycerides", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "hba1c", label: "HbA1c", unit: "%", units: ["%"] },
  { key: "creatinine", label: "Creatinine", unit: "mg/dL", units: ["mg/dL", "µmol/L"] },
  { key: "urea", label: "Urea", unit: "mg/dL", units: ["mg/dL", "mmol/L"] },
  { key: "tsh", label: "TSH", unit: "mIU/L", units: ["mIU/L"] },
  { key: "vitamin_d", label: "Vitamin D", unit: "ng/mL", units: ["ng/mL", "nmol/L"] },
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", units: ["g/dL", "g/L"] },
];

const DEFAULT_ACTIVITIES = [
  { key: "steps", label: "Steps", unit: "steps", units: ["steps"] },
  { key: "exercise", label: "Exercise", unit: "mins", units: ["mins", "hrs"] },
  { key: "water", label: "Water", unit: "ml", units: ["ml", "oz", "glasses"] },
  { key: "sleep", label: "Sleep", unit: "hrs", units: ["hrs", "mins"] },
];

const DEFAULT_YOGA = {
  title: "Medication Absorptive Flow",
  duration: "12 min",
  level: "Beginner",
  description: "Gentle daily asanas to enhance digestive circulation, improve medication absorption, and reduce stress.",
  steps: [
    { num: 1, name: "Anulom Vilom Pranayama", duration: "4 mins", benefit: "Calms nervous system & balances blood pressure", channel: "Swami Ramdev", youtube_video: "https://www.youtube.com/watch?v=1W_Q4m0sD78" },
    { num: 2, name: "Pawanmuktasana (Wind-relieving Pose)", duration: "4 mins", benefit: "Stimulates abdominal organs & assists medication digestion", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=L3F4z7t8_2w" },
    { num: 3, name: "Shavasana (Deep Relaxation)", duration: "4 mins", benefit: "Reduces stress hormones & stabilizes heart rate", channel: "Sadhguru", youtube_video: "https://www.youtube.com/watch?v=QPjwawKxuLw" },
  ],
  channels: [
    { name: "Ministry of AYUSH, Govt. of India", url: "https://www.youtube.com/@ministryofayushofficial", verified: true },
    { name: "Swami Ramdev — Patanjali Yogpeeth", url: "https://www.youtube.com/@SwamiRamdevOfficial", verified: true },
    { name: "Sadhguru — Isha Foundation", url: "https://www.youtube.com/@sadhguru", verified: true }
  ],
  disclaimer: "Consult your doctor before starting any new physical exercise routine."
};

export default function Treatment() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openYoga?: string }>();
  useEffect(() => { if (params?.openYoga) { setTab(0); if (!getFeatures().yoga_full) { setShowUpgrade(true); } else { setYogaOpen(true); } } }, [params?.openYoga]);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("all");
  const [meds, setMeds] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [mood, setMood] = useState<any[]>([]);
  const [yoga, setYoga] = useState<any>(null);
  const [yogaOpen, setYogaOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const trackYogaView = () => track("yoga_viewed");
  const [yogaTimePicker, setYogaTimePicker] = useState(false);
  const [yogaTime, setYogaTime] = useState<Date | null>(null);
  const [savedReminderTime, setSavedReminderTime] = useState<string | null>(null);
  const [drugFoodGuide, setDrugFoodGuide] = useState<any>(null);
  const [foodGuideOpen, setFoodGuideOpen] = useState(false);

  useEffect(() => {
    api.getDrugFoodGuide().then(g => { if (g) setDrugFoodGuide(g); }).catch(() => {});
  }, [meds]);

  // Load previously saved yoga reminder time on mount
  useEffect(() => {
    get<string>("yoga_reminder_time").then(t => {
      if (t) {
        setSavedReminderTime(t);
        const [h, m] = t.split(":").map(Number);
        const d = new Date(); d.setHours(h, m, 0, 0);
        setYogaTime(d);
      }
    }).catch(() => {});
  }, []);
  const [addMed, setAddMed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mModal, setMModal] = useState<{ open: boolean; type: any }>({ open: false, type: null });
  const [aModal, setAModal] = useState<{ open: boolean; type: any }>({ open: false, type: null });
  const [selectedMUnit, setSelectedMUnit] = useState<string>("");
  const [selectedAUnit, setSelectedAUnit] = useState<string>("");
  const [ms, setMs] = useState(3);
  const [mn, setMn] = useState("");
  const [vP, setVP] = useState("");
  const [vS, setVS] = useState("");
  const [vN, setVN] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string; channel?: string; benefit?: string; step?: any } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const safeCompletedSteps = Array.isArray(completedSteps) ? completedSteps : [];
  const isStepDone = (num: number) => safeCompletedSteps.includes(num);
  const yogaDoneKey = () => { const d = new Date(); return `yoga_done_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  useEffect(() => {
    get<any>(yogaDoneKey()).then(d => {
      if (Array.isArray(d)) setCompletedSteps(d);
      else if (d === true) setCompletedSteps([1, 2, 3, 4, 5]);
      else setCompletedSteps([]);
    });
  }, []);
  const toggleStepDone = async (step: any) => {
    const num = step.num;
    const isDone = isStepDone(num);
    const next = isDone ? safeCompletedSteps.filter(n => n !== num) : [...safeCompletedSteps, num];
    setCompletedSteps(next);
    await set(yogaDoneKey(), next);

    // Update local history array for Progress tab offline instant view
    const d = new Date();
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const historyCache = (await get<any[]>(K.history)) || [];

    let dayItem = historyCache.find((item: any) => item.date === dStr);
    if (!dayItem) {
      dayItem = { date: dStr, total: 0, taken: 0, entries: [] };
      historyCache.unshift(dayItem);
    }

    if (!isDone) {
      const newEntry = {
        id: `yoga_${num}_${Date.now()}`,
        name: `Yoga: ${step.name || "Therapy Pose"}`,
        generic_name: "AI Yoga Therapy",
        dosage: "",
        unit: "",
        time: hStr,
        status: "yoga_completed",
        note: `Completed ${step.duration || "pose"}`
      };
      if (!dayItem.entries.some((e: any) => e.name === newEntry.name)) {
        dayItem.entries.push(newEntry);
      }
      track("yoga_done", { pose: step.name });
      api.yogaComplete(num, step.name, step.youtube_video || step.youtube_channel).catch(() => {});
    } else {
      dayItem.entries = dayItem.entries.filter((e: any) => e.name !== `Yoga: ${step.name}`);
      api.yogaUncomplete(num, step.name).catch(() => {});
    }
    await set(K.history, [...historyCache]);
  };
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [refillMed, setRefillMed] = useState<{ id: string; name: string; stock?: number } | null>(null);
  const applyNudge = async (medId: string, n: any) => {
    try {
      await api.applyReminderNudge(medId, n.current_time, n.suggested_time);
      resyncReminders().catch(() => {});
      backgroundRefresh(loadServer);
    } catch {
      Alert.alert("Error", "Could not update the reminder time. Please try again.");
    }
  };

  // Load cache instantly
  const loadCache = useCallback(async () => {
    get<any[]>(K.medications).then(m => { if (m) setMeds(m); });
    get<any[]>(K.measurements).then(m => { if (m) setMeasurements(m); });
    get<any[]>(K.mood).then(m => { if (m) setMood(m); });
    get<any>(K.yogaTip).then(y => { if (y) setYoga(y); });
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const loadServer = useCallback(async () => {
    try {
      const [m, mes, act, mo, mc, ac] = await Promise.all([
        api.listMedications(true), api.listMeasurements(), api.listActivities(),
        api.listMood(), api.measurementCatalog(), api.activityCatalog()
      ]);
      if (m && Array.isArray(m)) setMeds(m);
      if (mes && Array.isArray(mes)) setMeasurements(mes);
      if (act && Array.isArray(act)) setActivities(act);
      if (mo && Array.isArray(mo)) setMood(mo);
      if (mc?.measurements) setCatalog((prev: any) => ({ ...prev, m: mc.measurements }));
      if (ac?.activities) setCatalog((prev: any) => ({ ...prev, a: ac.activities }));
      set(K.medications, m); set(K.measurements, mes); set(K.mood, mo);
      resyncReminders().catch(() => {});
    } catch {
      await loadCache();
    }
    // Fetch AI yoga tip in non-blocking background promise
    api.yogaTip().then(y => { if (y) { setYoga(y); set(K.yogaTip, y); } }).catch(() => {});
  }, [loadCache]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCache();
    try { await loadServer(); } catch {}
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    loadCache();
    backgroundRefresh(loadServer);
  }, [loadCache, loadServer]));

  const openMeasurementModal = (mt: any) => {
    setMModal({ open: true, type: mt });
    setSelectedMUnit(mt.unit || (mt.units && mt.units[0]) || "");
    setVP(""); setVS(""); setVN("");
  };

  const openActivityModal = (at: any) => {
    setAModal({ open: true, type: at });
    setSelectedAUnit(at.unit || (at.units && at.units[0]) || "");
    setVP(""); setVN("");
  };

  const saveMeasure = async () => {
    if (!mModal.type || !vP) return; setSaving(true);
    try { await api.createMeasurement({ type: mModal.type.key, value: parseFloat(vP), value_secondary: vS ? parseFloat(vS) : undefined, unit: selectedMUnit || mModal.type.unit || "unit", note: vN || undefined }); setMModal({ open: false, type: null }); setVP(""); setVS(""); setVN(""); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };
  const saveActivity = async () => {
    if (!aModal.type || !vP) return; setSaving(true);
    try { await api.createActivity({ type: aModal.type.key, value: parseFloat(vP), unit: selectedAUnit || aModal.type.unit || "unit", note: vN || undefined }); setAModal({ open: false, type: null }); setVP(""); setVN(""); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };
  const saveMood = async () => {
    setSaving(true);
    try { await api.createMood({ score: ms, note: mn || undefined }); setMn(""); setMs(3); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };

  const fm = filter === "refill" ? meds.filter(m => m.stock <= m.refill_threshold && m.active !== false) : filter === "active" ? meds.filter(m => m.active !== false) : filter === "completed" ? meds.filter(m => m.active === false || m.completed === true) : meds;
  const OPTS = [
    { icon: "medical-outline", title: "Add Medication", body: "Add a new medication to your routine", fn: () => { setSheet(false); setAddMed(true); } },
    { icon: "calendar-outline", title: "Book Appointment", body: "Schedule a doctor appointment", fn: () => { setSheet(false); router.push("/appointments"); } },
    { icon: "pulse-outline", title: "Log Measurement", body: "Blood pressure, glucose, weight...", fn: () => { setSheet(false); const mTypes = catalog?.m?.length ? catalog.m : DEFAULT_MEASUREMENTS; openMeasurementModal(mTypes[0]); } },
    { icon: "body-outline", title: "Log Activity", body: "Steps, exercise, walking...", fn: () => { setSheet(false); const aTypes = catalog?.a?.length ? catalog.a : DEFAULT_ACTIVITIES; openActivityModal(aTypes[0]); } },
    { icon: "heart-outline", title: "Log Mood", body: "Track how you're feeling today", fn: () => { setSheet(false); setTab(3); } },
  ];

  const scheduleYogaReminder = async (time: Date) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") await Notifications.requestPermissionsAsync();
      // Cancel existing yoga reminders
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content.data?.isYogaReminder) await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time for your Yoga Routine",
          body: yoga?.title ? `Today: ${yoga.title}` : "Open PillCare to start your daily yoga practice",
          data: { isYogaReminder: true },
          categoryIdentifier: YOGA_CATEGORY,
          sound: "pillcare_wellness",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.getHours(),
          minute: time.getMinutes(),
          channelId: "yoga-reminders",
        },
      });
      const h = String(time.getHours()).padStart(2, "0");
      const m = String(time.getMinutes()).padStart(2, "0");
      // Persist yoga time so Today screen can show it
      const timeStr = `${h}:${m}`;
      await set("yoga_reminder_time", timeStr);
      setSavedReminderTime(timeStr);
      setYogaTime(time);
      setYogaTimePicker(false);
      setYogaOpen(false);
      resyncReminders().catch(() => {});
      Alert.alert("Yoga Reminder Set", `Daily reminder set for ${h}:${m}`);
    } catch {
      Alert.alert("Error", "Could not set yoga reminder. Please try again.");
    }
  };

  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[s.title, { color: theme.textPrimary }]}>{t("treatment.title", "My Medications")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 6 }} testID="refresh-treatment-btn">
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS.map((t, i) => (<TouchableOpacity key={t} onPress={() => setTab(i)} style={[s.tab, i === tab && s.tabOn]}><Text style={[s.tabT, i === tab && s.tabTOn]}>{t}</Text></TouchableOpacity>))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A3} colors={[A3]} />}>
        {/* MEDICATIONS */}
        {tab === 0 && (<View style={{ gap: 10 }}>
          {/* Filter tags - above yoga card so yoga doesn't shift */}
          <View style={s.fRow}>
            {["all", "active", "refill", "completed"].map(f => (<TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.tag, filter === f && s.tagOn]}><Text style={[s.tagT, filter === f && s.tagTOn]}>{f === "all" ? `All (${meds.length})` : f === "active" ? "Active" : f === "refill" ? "Refill Soon" : "Completed Courses"}</Text></TouchableOpacity>))}
          </View>

          {/* Yoga AI card - fixed position under Medications tab */}
          {(() => {
            const activeYoga = yoga || DEFAULT_YOGA;
            return (
              <View style={[s.card, { borderColor: "rgba(145,132,217,0.3)", flexDirection: "row", alignItems: "center", gap: 12 }]}>
                <View style={[s.cI, { borderRadius: 18, width: 36, height: 36 }]}>
                  <Ionicons name="body-outline" size={17} color={A3} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <Ionicons name="sparkles" size={10} color={A3} />
                    <Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDED YOGA</Text>
                  </View>
                  <Text style={s.cT}>{activeYoga.title || "Gentle Flow"}</Text>
                  <Text style={s.cS}>{activeYoga.duration || "12 min"} • {activeYoga.level || "Beginner"}</Text>
                </View>
                <TouchableOpacity style={s.viewBtn} onPress={() => { if (!getFeatures().yoga_full) { setShowUpgrade(true); return; } setYogaOpen(true); }}>
                  <Text style={s.viewBtnT}>View</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
          {/* Drug & Food Interaction & Do's and Don'ts Card */}
          {drugFoodGuide && drugFoodGuide.has_medications && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[s.card, { borderColor: "rgba(74,222,128,0.3)", backgroundColor: "rgba(74,222,128,0.05)" }]}
              onPress={() => setFoodGuideOpen(true)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.cI, { borderRadius: 18, width: 36, height: 36, backgroundColor: "rgba(74,222,128,0.15)" }]}>
                  <Ionicons name="restaurant-outline" size={17} color="#4ade80" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <Ionicons name="shield-checkmark-outline" size={10} color="#4ade80" />
                    <Text style={{ fontSize: 9, letterSpacing: 1, color: "#4ade80", fontWeight: "700" }}>DRUG & FOOD CLINICAL GUIDE</Text>
                  </View>
                  <Text style={s.cT}>Food & Medicine Do's & Don'ts</Text>
                  <Text style={s.cS}>{drugFoodGuide.scanned_medications} medicines scanned • Food timing & advice</Text>
                </View>
                <View style={[s.viewBtn, { backgroundColor: "rgba(74,222,128,0.2)" }]}>
                  <Text style={[s.viewBtnT, { color: "#4ade80" }]}>View</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

      {/* Drug-Food Modal Guide */}
      <DrugFoodGuideModal
        visible={foodGuideOpen}
        onClose={() => setFoodGuideOpen(false)}
        guide={drugFoodGuide}
      />
          {fm.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="medical-outline" size={26} color={AC} />
              <Text style={s.emT}>{filter === "refill" ? "No refills needed" : filter === "completed" ? "No completed courses" : "No medications"}</Text>
              <Text style={s.emS}>{filter === "refill" ? "All stocks are sufficient" : filter === "completed" ? "Finished medication courses will appear here" : "Tap + to add one"}</Text>
            </View>
          ) : (
            fm.map(m => {
              const guide = drugFoodGuide?.guides?.find((g: any) =>
                g.medication?.toLowerCase().includes(m.name?.toLowerCase()) ||
                m.name?.toLowerCase().includes(g.medication?.toLowerCase())
              );
              const isCompleted = m.active === false || m.completed === true;
              return (
                <View key={m.id} style={[s.card, isCompleted && { borderColor: "rgba(74,222,128,0.25)", backgroundColor: "rgba(74,222,128,0.03)" }]}>
                  <View style={s.cRow}>
                    <View style={[s.cI, isCompleted && { backgroundColor: "rgba(74,222,128,0.15)" }]}>
                      <Ionicons name={isCompleted ? "checkmark-done-circle-outline" : "medical-outline"} size={17} color={isCompleted ? "#4ade80" : A3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cT}>{m.name}</Text>
                      {m.generic_name ? <Text style={[s.cS, { color: A3, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                      <Text style={s.cS}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
                      {m.food_relation ? (
                        <View style={{ marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(56,189,248,0.1)", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", alignSelf: "flex-start" }}>
                          <Text style={{ fontSize: 9, color: "#38bdf8", fontWeight: "700" }}>
                            {m.food_relation === "before_food" ? "Before Food" : m.food_relation === "with_food" ? "With Food" : m.food_relation === "anytime" ? "Anytime" : "After Food"}
                          </Text>
                        </View>
                      ) : null}
                      {m.notes ? (
                        <Text style={{ fontSize: 10, color: TM, fontStyle: "italic", marginTop: 2 }}>
                          Note: {m.notes}
                        </Text>
                      ) : null}
                    </View>
                    {isCompleted ? (
                      <View style={[s.rTag, { backgroundColor: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.3)" }]}>
                        <Text style={[s.rTx, { color: "#4ade80" }]}>Completed</Text>
                      </View>
                    ) : (m.stock <= m.refill_threshold || (m.days_left != null && m.days_left <= 3)) ? (
                      <View style={s.rTag}><Text style={s.rTx}>{m.days_left != null ? `~${m.days_left}d left` : "Refill Soon"}</Text></View>
                    ) : null}
                  </View>
                  {guide?.dos?.[0] && (
                    <View style={{ marginTop: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(74,222,128,0.08)", borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="restaurant-outline" size={11} color="#4ade80" />
                      <Text style={{ fontSize: 10, color: "#4ade80", fontWeight: "600", flex: 1 }}>{guide.dos[0]}</Text>
                    </View>
                  )}
                  <View style={s.cFt}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="time-outline" size={11} color={A3} /><Text style={s.ftT}>{(m.times || []).join(" • ") || "No times set"}</Text></View>
                    <Text style={s.ftT}>{isCompleted ? "Course Finished" : `${m.stock} left`}</Text>
                  </View>

                  {/* Refill / Completion Action Row */}
                  {!isCompleted && m.stock <= m.refill_threshold && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(56,189,248,0.12)", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                        onPress={() => setRefillMed(m)}>
                        <Ionicons name="cube-outline" size={14} color="#38bdf8" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#38bdf8" }}>Refill Stock</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={{ backgroundColor: "rgba(74,222,128,0.12)", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(74,222,128,0.3)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                        onPress={() => {
                          Alert.alert("Mark Course Complete?", `Mark treatment for ${m.name} as complete?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Mark Complete", onPress: async () => {
                              setMeds(prev => prev.map(item => item.id === m.id ? { ...item, active: false, completed: true, completed_at: new Date().toISOString() } : item));
                              try {
                                await logCourseCompleted(m.id, m.name, m.generic_name, m.dosage, m.unit);
                                await api.completeMedication(m.id);
                              } catch {}
                              await loadServer();
                            }}
                          ]);
                        }}>
                        <Ionicons name="checkmark-done-circle-outline" size={14} color="#4ade80" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#4ade80" }}>Course Complete</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Completed Course Restart Option */}
                  {isCompleted && (
                    <View style={{ marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: "rgba(74,222,128,0.08)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="checkmark-done-circle" size={14} color="#4ade80" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#4ade80" }}>COURSE COMPLETED</Text>
                      </View>
                      <TouchableOpacity style={{ backgroundColor: "rgba(56,189,248,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                        onPress={() => setRefillMed(m)}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#38bdf8" }}>Restart Course</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(m.nudges || []).filter((n: any) => !dismissedNudges.has(`${m.id}_${n.current_time}`)).slice(0, 1).map((n: any) => (
                    <View key={n.current_time} style={{ marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: "rgba(229,178,133,0.1)", borderWidth: 1, borderColor: "rgba(229,178,133,0.3)", gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="bulb-outline" size={13} color="#e5b285" />
                        <Text style={{ fontSize: 10, color: "#e5b285", fontWeight: "700" }}>SMART NUDGE</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: TM, lineHeight: 15 }}>
                        {`You miss the ${n.current_time} dose ${n.miss_rate}% of the time. Move the reminder to ${n.suggested_time}?`}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity style={{ flex: 1, backgroundColor: "#e5b285", borderRadius: 8, paddingVertical: 7, alignItems: "center" }}
                          onPress={() => applyNudge(m.id, n)}>
                          <Text style={{ fontSize: 11, color: "#161826", fontWeight: "700" }}>{`Shift to ${n.suggested_time}`}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ paddingHorizontal: 12, justifyContent: "center" }}
                          onPress={() => setDismissedNudges(prev => new Set(prev).add(`${m.id}_${n.current_time}`))}>
                          <Text style={{ fontSize: 11, color: TM }}>Not now</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
          {/* Find Medical Store — always shown at bottom of medications */}
          <TouchableOpacity style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12, borderColor: "rgba(74,222,128,0.25)", marginTop: 4 }]}
            onPress={() => router.push("/nearby?type=pharmacy" as any)}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(74,222,128,0.1)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="medkit-outline" size={18} color="#4ade80" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cT}>Find Nearest Medical Store</Text>
              <Text style={s.cS}>Pharmacies & chemists near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={TM} />
          </TouchableOpacity>
        </View>)}

        {/* MEASUREMENTS */}
        {tab === 1 && (() => {
          const mTypes = catalog?.m?.length ? catalog.m : DEFAULT_MEASUREMENTS;
          return (
            <View style={{ gap: 10 }}>
              <Text style={s.secL}>LOG A MEASUREMENT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {mTypes.map((mt: any) => (
                  <TouchableOpacity key={mt.key} style={s.chip} onPress={() => openMeasurementModal(mt)}>
                    <Ionicons name="pulse-outline" size={12} color={A3} />
                    <Text style={s.chipT}>{mt.label} <Text style={{ color: TM, fontSize: 10 }}>({mt.unit})</Text></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {measurements.length > 0 ? (
                <>
                  <Text style={s.secL}>RECENT</Text>
                  {measurements.slice(0, 10).map((m: any, i: number) => (
                    <View key={i} style={s.card}>
                      <View style={s.cRow}>
                        <View style={s.cI}><Ionicons name="pulse-outline" size={15} color={A3} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cT}>{m.type?.replace(/_/g, " ")}</Text>
                          <Text style={s.cS}>{new Date(m.recorded_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: A3 }}>
                          {m.value}{m.value_secondary ? `/${m.value_secondary}` : ""}
                          <Text style={{ fontSize: 10, color: TM }}> {m.unit}</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={s.empty}>
                  <Ionicons name="pulse-outline" size={28} color={AC} />
                  <Text style={s.emT}>No measurements yet</Text>
                  <Text style={s.emS}>Tap a category above to log one</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* ACTIVITIES */}
        {tab === 2 && (() => {
          const aTypes = catalog?.a?.length ? catalog.a : DEFAULT_ACTIVITIES;
          return (
            <View style={{ gap: 10 }}>
              <Text style={s.secL}>LOG AN ACTIVITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {aTypes.map((at: any) => (
                  <TouchableOpacity key={at.key} style={s.chip} onPress={() => openActivityModal(at)}>
                    <Ionicons name="body-outline" size={12} color={A3} />
                    <Text style={s.chipT}>{at.label} <Text style={{ color: TM, fontSize: 10 }}>({at.unit})</Text></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {activities.length > 0 ? (
                <>
                  <Text style={s.secL}>RECENT</Text>
                  {activities.slice(0, 10).map((a: any, i: number) => (
                    <View key={i} style={s.card}>
                      <View style={s.cRow}>
                        <View style={s.cI}><Ionicons name="body-outline" size={15} color={A3} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cT}>{a.type?.replace(/_/g, " ")}</Text>
                          <Text style={s.cS}>{new Date(a.recorded_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: A3 }}>{a.value}<Text style={{ fontSize: 10, color: TM }}> {a.unit}</Text></Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={s.empty}>
                  <Ionicons name="body-outline" size={28} color={AC} />
                  <Text style={s.emT}>No activities yet</Text>
                  <Text style={s.emS}>Tap a category above to log one</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* MOOD */}
        {tab === 3 && (<View style={{ gap: 10 }}>
          <View style={s.card}>
            <Text style={s.cT}>How are you feeling today?</Text>
            <View style={s.mRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setMs(n)} style={[s.mBtn, ms === n && { borderColor: MC[n], backgroundColor: `${MC[n]}22` }]}>
                  <Text style={{ fontSize: 22 }}>{ME[n]}</Text>
                  <Text style={[s.mNum, ms === n && { color: MC[n] }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={mn} onChangeText={setMn} placeholder="Add a note (optional)" placeholderTextColor={TM} style={s.inp} multiline />
            <TouchableOpacity style={s.subBtn} onPress={saveMood} disabled={saving}><Text style={s.subT}>{saving ? "Saving…" : "Log Mood"}</Text></TouchableOpacity>
          </View>
          {mood.length > 0 && (
            <>
              <Text style={s.secL}>Recent Logs</Text>
              {mood.slice(0, 6).map((m: any, i: number) => (
                <View key={i} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
                  <Text style={{ fontSize: 24 }}>{ME[m.score] || "😐"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cT}>Mood {m.score}/5 ({MOOD_LABELS[m.score] || "Neutral"})</Text>
                    <Text style={s.cS}>{new Date(m.recorded_at).toLocaleDateString()}</Text>
                  </View>
                  {m.note && <Text style={[s.cS, { maxWidth: 100, textAlign: "right" }]}>{m.note}</Text>}
                </View>
              ))}
            </>
          )}
        </View>)}
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={() => setSheet(true)}><Ionicons name="add" size={24} color={BG} /></TouchableOpacity>

      {/* Action Sheet */}
      <ActionSheetModal
        visible={sheet}
        onClose={() => setSheet(false)}
        options={OPTS}
      />

      {/* Yoga Detail Modal */}
      <Modal visible={yogaOpen} transparent animationType="slide" onRequestClose={() => setYogaOpen(false)}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setYogaOpen(false)}>
          <View style={[s.sBox, { maxHeight: "92%" }]}>
            {/* Header row with close X */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={10} color={A3} />
                <Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDED YOGA</Text>
              </View>
              <TouchableOpacity onPress={() => setYogaOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(233,233,237,0.1)", alignItems: "center", justifyContent: "center" }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={16} color={TM} />
              </TouchableOpacity>
            </View>
            <Text style={s.sTitle}>{yoga?.title || "Gentle Flow"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={s.chip}><Ionicons name="time-outline" size={11} color={A3} /><Text style={s.chipT}>{yoga?.duration || "12 min"}</Text></View>
              <View style={s.chip}><Ionicons name="speedometer-outline" size={11} color={A3} /><Text style={s.chipT}>{yoga?.level || "Beginner"}</Text></View>
            </View>
            <Text style={[s.cS, { lineHeight: 17 }]}>{yoga?.description || ""}</Text>
            <Text style={[s.secL, { marginTop: 4 }]}>ROUTINE · {safeCompletedSteps.length}/{(yoga?.steps || []).length} done today</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(yoga?.steps || []).map((step: any) => {
                const stepDone = isStepDone(step.num);
                return (
                  <View key={step.num} style={[s.card, { gap: 8, marginBottom: 8 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.cI, { borderRadius: 13 }, stepDone && { backgroundColor: "rgba(74,222,128,0.18)" }]}>
                        {stepDone ? <Ionicons name="checkmark" size={14} color="#4ade80" /> : <Text style={{ fontSize: 11, color: A3, fontWeight: "700" }}>{step.num}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cT}>{step.name}</Text>
                        <Text style={s.cS}>{step.duration}</Text>
                        {step.benefit ? <Text style={[s.cS, { color: A3, marginTop: 2 }]}>{step.benefit}</Text> : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,0,0,0.12)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "rgba(255,0,0,0.3)" }}
                      onPress={() => setActiveVideo({
                        url: step.youtube_video || step.youtube_channel || "https://www.youtube.com/watch?v=QPjwawKxuLw",
                        title: step.name,
                        channel: step.channel || "Swami Ramdev",
                        benefit: step.benefit,
                        step: step,
                      })}>
                      <Ionicons name="play-circle" size={16} color="#FF0000" />
                      <Text style={{ fontSize: 11, color: TX, flex: 1, fontWeight: "700" }}>Watch Inside App</Text>
                      <Text style={{ fontSize: 9, color: A3, fontWeight: "600" }}>{step.channel || "Swami Ramdev"}</Text>
                      <Ionicons name="chevron-forward" size={12} color={A3} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, backgroundColor: stepDone ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: stepDone ? "rgba(74,222,128,0.3)" : BD }} onPress={() => toggleStepDone(step)}>
                      <Ionicons name={stepDone ? "checkmark-circle" : "ellipse-outline"} size={14} color={stepDone ? "#4ade80" : TM} />
                      <Text style={{ fontSize: 10, color: stepDone ? "#4ade80" : TM, fontWeight: "600" }}>{stepDone ? "Marked as Done" : "Mark as Done"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <Text style={[s.secL, { marginTop: 10, marginBottom: 8 }]}>VERIFIED SOURCES</Text>
              {(yoga?.channels || [
                { name: "Ministry of AYUSH, Govt. of India", url: "https://www.youtube.com/@ministryofayushofficial", verified: true },
                { name: "Swami Ramdev — Patanjali Yogpeeth", url: "https://www.youtube.com/@SwamiRamdevOfficial", verified: true },
                { name: "Sadhguru — Isha Foundation (Padma Vibhushan, UN recognised)", url: "https://www.youtube.com/@sadhguru", verified: true },
              ]).map((ch: any) => (
                <TouchableOpacity key={ch.url}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BD }}
                  onPress={() => Linking.openURL(ch.url)}>
                  <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                  <Text style={{ fontSize: 11, color: TX, flex: 1 }}>{ch.name}</Text>
                  {ch.verified && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(74,222,128,0.15)", borderRadius: 4 }}>
                    <Text style={{ fontSize: 8, color: "#4ade80", fontWeight: "700" }}>✓ VERIFIED</Text>
                  </View>}
                </TouchableOpacity>
              ))}
              <Text style={[s.cS, { fontStyle: "italic", marginTop: 10, marginBottom: 12, lineHeight: 15 }]}>{yoga?.disclaimer || ""}</Text>
            </ScrollView>
            {/* Reminder button — shows current time if set, allows editing */}
            {savedReminderTime ? (
              <TouchableOpacity
                style={[s.subBtn, { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.3)", borderWidth: 1 }]}
                onPress={() => {
                  setYogaOpen(false);
                  setTimeout(() => setYogaTimePicker(true), 350);
                }}>
                <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                <Text style={[s.subT, { color: "#4ade80" }]}>
                  {"Daily reminder at " + savedReminderTime + "  —  Edit"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.subBtn, { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }]}
                onPress={() => {
                  setYogaOpen(false);
                  setTimeout(() => setYogaTimePicker(true), 350);
                }}>
                <Ionicons name="notifications-outline" size={16} color="#fff" />
                <Text style={s.subT}>Set Daily Reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {yogaTimePicker && (
      <DateTimePicker
        value={yogaTime || (() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; })()}
        mode="time"
        is24Hour={false}
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={(_, selected) => {
          setYogaTimePicker(false);
          if (selected) scheduleYogaReminder(selected);
        }}
        />
      )}
      {/* Measurement Modal */}
      <Modal visible={mModal.open} transparent animationType="slide" onRequestClose={() => setMModal({ open: false, type: null })}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setMModal({ open: false, type: null })}>
          <View style={s.sBox}>
            <View style={s.hand} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.sTitle}>Log {mModal.type?.label}</Text>
              <TouchableOpacity onPress={() => setMModal({ open: false, type: null })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 2 }}>
              <Text style={{ fontSize: 11, color: TM, fontWeight: "600" }}>Unit:</Text>
              {(mModal.type?.units || [mModal.type?.unit || ""]).map((u: string) => (
                <TouchableOpacity key={u} onPress={() => setSelectedMUnit(u)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: selectedMUnit === u ? AB : SF, borderWidth: 1, borderColor: selectedMUnit === u ? AC : BD }}>
                  <Text style={{ fontSize: 11, color: selectedMUnit === u ? A3 : TM, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mModal.type?.composite || mModal.type?.key === "blood_pressure" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>Systolic (Upper number, e.g. 120)</Text>
                  <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder="120" placeholderTextColor={TM} style={s.inp} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>Diastolic (Lower number, e.g. 80)</Text>
                  <TextInput value={vS} onChangeText={setVS} keyboardType="decimal-pad" placeholder="80" placeholderTextColor={TM} style={s.inp} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>Value ({selectedMUnit || mModal.type?.unit})</Text>
                <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder={`Enter value in ${selectedMUnit || mModal.type?.unit || ""}`} placeholderTextColor={TM} style={s.inp} />
              </View>
            )}
            <TextInput value={vN} onChangeText={setVN} placeholder="Notes / Observations (optional)" placeholderTextColor={TM} style={s.inp} />
            <TouchableOpacity style={s.subBtn} onPress={saveMeasure} disabled={saving || !vP}><Text style={s.subT}>{saving ? "Saving…" : "Save Measurement"}</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 10, alignItems: "center" }} onPress={() => setMModal({ open: false, type: null })}><Text style={{ color: TM }}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={aModal.open} transparent animationType="slide" onRequestClose={() => setAModal({ open: false, type: null })}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setAModal({ open: false, type: null })}>
          <View style={s.sBox}>
            <View style={s.hand} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.sTitle}>Log {aModal.type?.label}</Text>
              <TouchableOpacity onPress={() => setAModal({ open: false, type: null })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 2 }}>
              <Text style={{ fontSize: 11, color: TM, fontWeight: "600" }}>Unit:</Text>
              {(aModal.type?.units || [aModal.type?.unit || ""]).map((u: string) => (
                <TouchableOpacity key={u} onPress={() => setSelectedAUnit(u)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: selectedAUnit === u ? AB : SF, borderWidth: 1, borderColor: selectedAUnit === u ? AC : BD }}>
                  <Text style={{ fontSize: 11, color: selectedAUnit === u ? A3 : TM, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>Value ({selectedAUnit || aModal.type?.unit})</Text>
              <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder={`Enter amount in ${selectedAUnit || aModal.type?.unit || ""}`} placeholderTextColor={TM} style={s.inp} />
            </View>
            <TextInput value={vN} onChangeText={setVN} placeholder="Notes (optional)" placeholderTextColor={TM} style={s.inp} />
            <TouchableOpacity style={s.subBtn} onPress={saveActivity} disabled={saving || !vP}><Text style={s.subT}>{saving ? "Saving…" : "Save Activity"}</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 10, alignItems: "center" }} onPress={() => setAModal({ open: false, type: null })}><Text style={{ color: TM }}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={() => { setAddMed(false); loadCache(); get<any[]>(K.medications).then(m => { if (m) resyncReminders(m); }).catch(() => resyncReminders()); backgroundRefresh(loadServer); }} />
      <RefillModal visible={!!refillMed} medication={refillMed} onClose={() => setRefillMed(null)} onRefilled={async () => { await loadServer(); }} />
      <UpgradePrompt visible={showUpgrade} onClose={() => setShowUpgrade(false)} feature="Full yoga library" description="Free plan includes a daily yoga tip. Upgrade to Pro Dharma for full guided routines with video demos." />
      <VideoPlayerModal
        visible={!!activeVideo}
        onClose={() => setActiveVideo(null)}
        videoUrl={activeVideo?.url}
        title={activeVideo?.title}
        channel={activeVideo?.channel}
        benefit={activeVideo?.benefit}
        onCompleteSession={() => {
          if (activeVideo?.step) {
            toggleStepDone(activeVideo.step);
          }
        }}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, hdr: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }, title: { fontSize: 20, fontWeight: "700", color: TX, letterSpacing: -.4 },
  tabs: { paddingHorizontal: 16, paddingVertical: 8, gap: 7 }, tab: { paddingHorizontal: 14, height: 32, borderRadius: 999, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: AB, borderColor: AC }, tabT: { fontSize: 12, color: TM, fontWeight: "600" }, tabTOn: { color: A3 },
  body: { padding: 16, paddingBottom: 120, gap: 10 }, fRow: { flexDirection: "row", gap: 7 },
  tag: { paddingHorizontal: 12, height: 28, borderRadius: 999, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  tagOn: { backgroundColor: AB, borderColor: AC }, tagT: { fontSize: 11, color: TM, fontWeight: "600" }, tagTOn: { color: A3 },
  card: { backgroundColor: SF, borderRadius: 14, padding: 13, gap: 8, borderWidth: 1, borderColor: BD },
  cRow: { flexDirection: "row", alignItems: "center", gap: 10 }, cI: { width: 36, height: 36, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 13, fontWeight: "600", color: TX }, cS: { fontSize: 10, color: TM, marginTop: 1 },
  cFt: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: BD }, ftT: { fontSize: 10, color: TM },
  rTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(167,161,219,0.18)" }, rTx: { fontSize: 9, color: A3, fontWeight: "700" },
  secL: { fontSize: 10, letterSpacing: 1, color: TM, fontWeight: "700" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 999, backgroundColor: SF, borderWidth: 1, borderColor: BD }, chipT: { fontSize: 11, color: TM, fontWeight: "600" },
  viewBtn: { paddingHorizontal: 12, height: 28, borderRadius: 8, backgroundColor: SF, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" }, viewBtnT: { fontSize: 11, color: TX, fontWeight: "600" },
  mRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }, mBtn: { alignItems: "center", gap: 3, padding: 6, borderRadius: 10, borderWidth: 1.5, borderColor: BD, flex: 1, margin: 2 }, mNum: { fontSize: 10, color: TM, fontWeight: "700" },
  inp: { backgroundColor: "#1e2030", borderRadius: 10, padding: 12, color: TX, fontSize: 14, borderWidth: 1, borderColor: BD, marginTop: 4 },
  subBtn: { backgroundColor: AC, borderRadius: 11, padding: 13, alignItems: "center", marginTop: 6 }, subT: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fab: { position: "absolute", right: 18, bottom: 90, width: 52, height: 52, borderRadius: 26, backgroundColor: AC, alignItems: "center", justifyContent: "center", elevation: 6 },
  ovl: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sBox: { backgroundColor: N8, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12, zIndex: 10, elevation: 10 },
  hand: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }, sTitle: { fontSize: 16, fontWeight: "700", color: TX },
  sOpt: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: SF, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: BD },
  empty: { backgroundColor: SF, borderRadius: 14, padding: 32, alignItems: "center", gap: 8, borderWidth: 1, borderColor: BD }, emT: { fontSize: 14, fontWeight: "700", color: TX }, emS: { fontSize: 12, color: TM, textAlign: "center" },
});
