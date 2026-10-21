import { useCallback, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Linking, Alert, Platform, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { RefillModal } from "@/src/components/RefillModal";
import { api } from "@/src/lib/api";
import { track, trackScreenView } from "@/src/lib/analytics";
import { resyncReminders, YOGA_CATEGORY, scheduleYogaReminderFromStore } from "@/src/lib/notifications";
import { get, set, K, logCourseCompleted } from "@/src/lib/store";
import { backgroundRefresh, enqueueWrite, flushQueue } from "@/src/lib/sync";
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
    { num: 1, name: "Anulom Vilom Pranayama", duration: "4 mins", benefit: "Calms nervous system & balances blood pressure", channel: "Swami Ramdev", youtube_video: "https://www.youtube.com/watch?v=MqeeqXMdZ54" },
    { num: 2, name: "Pawanmuktasana (Wind-relieving Pose)", duration: "4 mins", benefit: "Stimulates abdominal organs & assists medication digestion", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=TVHlCr49LNY" },
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
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ openYoga?: string }>();
  useEffect(() => { if (params?.openYoga) { setTab(0); if (!getFeatures().yoga_full) { setShowUpgrade(true); } else { setYogaOpen(true); } } }, [params?.openYoga]);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("active");
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
  const toggleStepDone = async (step: any, forceDone = false) => {
    const num = step.num;
    const isDone = isStepDone(num);
    if (forceDone && isDone) return;
    const next = isDone && !forceDone ? safeCompletedSteps.filter(n => n !== num) : [...safeCompletedSteps, num];
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
      await flushQueue().catch(() => {});
      const [m, mes, act, mo, mc, ac] = await Promise.all([
        api.listMedications(true), api.listMeasurements(), api.listActivities(),
        api.listMood(), api.measurementCatalog(), api.activityCatalog()
      ]);
      if (m && Array.isArray(m)) {
        const localMeds = (await get<any[]>(K.medications)) || [];
        const pendingLocal = localMeds.filter(lm => lm && lm.id && String(lm.id).startsWith("local_"));
        const serverIds = new Set(m.map(sm => String(sm.id)));
        const combined = [...m, ...pendingLocal.filter(pl => !serverIds.has(String(pl.id)))];
        const finalMeds = dedupeMeds(combined);
        setMeds(finalMeds);
        await set(K.medications, finalMeds);
      }
      if (mes && Array.isArray(mes)) { setMeasurements(mes); set(K.measurements, mes); }
      if (act && Array.isArray(act)) setActivities(act);
      if (mo && Array.isArray(mo)) { setMood(mo); set(K.mood, mo); }
      if (mc?.measurements) setCatalog((prev: any) => ({ ...prev, m: mc.measurements }));
      if (ac?.activities) setCatalog((prev: any) => ({ ...prev, a: ac.activities }));
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

  const lastTreatmentFetchRef = useRef<number>(0);

  useFocusEffect(useCallback(() => {
    loadCache();
    const now = Date.now();
    if (now - lastTreatmentFetchRef.current > 5 * 60 * 1000) {
      lastTreatmentFetchRef.current = now;
      backgroundRefresh(loadServer);
    }
    trackScreenView("treatment");
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
    if (!mModal.type) return;
    const val = vP.trim();
    if (!val || isNaN(parseFloat(val))) {
      Alert.alert("Enter Value", "Please enter a valid numeric measurement value before saving.");
      return;
    }
    setSaving(true);
    const payload = {
      type: mModal.type.key,
      value: parseFloat(val),
      value_secondary: vS && !isNaN(parseFloat(vS.trim())) ? parseFloat(vS.trim()) : undefined,
      unit: selectedMUnit || mModal.type.unit || "unit",
      note: vN || undefined,
      created_at: new Date().toISOString(),
    };
    const updated = [payload, ...measurements];
    setMeasurements(updated);
    await set(K.measurements, updated);
    setMModal({ open: false, type: null }); setVP(""); setVS(""); setVN("");
    try {
      await api.createMeasurement(payload);
    } catch {
      await enqueueWrite("measurement", payload);
    } finally {
      setSaving(false);
      backgroundRefresh(loadServer);
    }
  };

  const saveActivity = async () => {
    if (!aModal.type) return;
    const val = vP.trim();
    if (!val || isNaN(parseFloat(val))) {
      Alert.alert("Enter Value", "Please enter a valid duration or count for this activity.");
      return;
    }
    setSaving(true);
    const payload = {
      type: aModal.type.key,
      value: parseFloat(val),
      unit: selectedAUnit || aModal.type.unit || "unit",
      note: vN || undefined,
      created_at: new Date().toISOString(),
    };
    const updated = [payload, ...activities];
    setActivities(updated);
    await set(K.activities, updated);
    setAModal({ open: false, type: null }); setVP(""); setVN("");
    try {
      await api.createActivity(payload);
    } catch {
      await enqueueWrite("activity", payload);
    } finally {
      setSaving(false);
      backgroundRefresh(loadServer);
    }
  };

  const saveMood = async () => {
    setSaving(true);
    const payload = {
      score: ms,
      note: mn || undefined,
      created_at: new Date().toISOString(),
    };
    const updated = [payload, ...mood];
    setMood(updated);
    await set(K.mood, updated);
    setMn(""); setMs(3);
    try {
      await api.createMood(payload);
    } catch {
      await enqueueWrite("mood", payload);
    } finally {
      setSaving(false);
      backgroundRefresh(loadServer);
    }
  };

  const dedupeMeds = (arr: any[]) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    return arr.filter((m: any) => {
      if (!m) return false;
      const key = m.id ? String(m.id) : `${m.name?.trim().toLowerCase()}_${m.dosage}_${(m.times || []).join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const safeMeds = Array.isArray(meds) ? meds : [];
  const activeMedsList = safeMeds.filter((m: any) => m && m.active !== false && m.completed !== true);
  const completedMedsList = safeMeds.filter((m: any) => m && (m.active === false || m.completed === true));
  const refillMedsList = activeMedsList.filter((m: any) => m && (m.stock <= (m.refill_threshold ?? 5) || (m.days_left != null && m.days_left <= 3)));

  const fm = dedupeMeds(
    filter === "active"
      ? activeMedsList
      : filter === "completed"
      ? completedMedsList
      : filter === "refill"
      ? refillMedsList
      : safeMeds
  );
  const OPTS = [
    { icon: "medical-outline", title: t("actionSheet.addMedication", "Add Medication"), body: t("actionSheet.addMedicationDesc", "Add a new medication to your routine"), fn: () => { setSheet(false); setAddMed(true); } },
    { icon: "calendar-outline", title: t("actionSheet.bookAppointment", "Book Appointment"), body: t("actionSheet.bookAppointmentDesc", "Schedule a doctor appointment"), fn: () => { setSheet(false); router.push("/appointments" as any); } },
    { icon: "pulse-outline", title: t("actionSheet.logMeasurement", "Log Measurement"), body: t("actionSheet.logMeasurementDesc", "Blood pressure, glucose, weight..."), fn: () => { setSheet(false); const mTypes = catalog?.m?.length ? catalog.m : DEFAULT_MEASUREMENTS; openMeasurementModal(mTypes[0]); } },
    { icon: "body-outline", title: t("actionSheet.logActivity", "Log Activity"), body: t("actionSheet.logActivityDesc", "Steps, exercise, walking..."), fn: () => { setSheet(false); const aTypes = catalog?.a?.length ? catalog.a : DEFAULT_ACTIVITIES; openActivityModal(aTypes[0]); } },
    { icon: "heart-outline", title: t("actionSheet.logMood", "Log Mood"), body: t("actionSheet.logMoodDesc", "Track how you're feeling today"), fn: () => { setSheet(false); setTab(3); } },
  ];

  const scheduleYogaReminder = async (time: Date) => {
    try {
      await scheduleYogaReminderFromStore(time);
      const h = String(time.getHours()).padStart(2, "0");
      const m = String(time.getMinutes()).padStart(2, "0");
      const timeStr = `${h}:${m}`;
      setSavedReminderTime(timeStr);
      setYogaTime(time);
      setYogaTimePicker(false);
      setYogaOpen(false);
      Alert.alert("Yoga Reminder Set", `Daily reminder scheduled at ${h}:${m}`);
    } catch {
      Alert.alert("Error", "Could not set yoga reminder. Please try again.");
    }
  };

  const TABS_CONFIG = [
    { key: "medications", label: t("treatment.medicationsTab", "Medications") },
    { key: "measurements", label: t("treatment.measurementsTab", "Measurements") },
    { key: "activities", label: t("treatment.activitiesTab", "Activities") },
    { key: "mood", label: t("treatment.moodTab", "Mood") },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[s.title, { color: theme.textPrimary }]}>{t("treatment.title", "My Medications")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push("/nearby?type=pharmacy" as any)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)",
              borderWidth: 1,
              borderColor: "rgba(16,185,129,0.3)",
            }}
          >
            <Ionicons name="medkit-outline" size={14} color="#10B981" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>Pharmacies</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 6 }} testID="refresh-treatment-btn">
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS_CONFIG.map((tConfig, i) => (
          <TouchableOpacity
            key={tConfig.key}
            onPress={() => setTab(i)}
            style={[
              s.tab,
              { borderColor: theme.surfaceBorder },
              i === tab && { backgroundColor: theme.accentBg, borderColor: theme.accent }
            ]}
          >
            <Text style={[s.tabT, { color: theme.textSecondary }, i === tab && { color: theme.accent, fontWeight: "700" }]}>
              {tConfig.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}>
        {/* Top Quick Pharmacy Shortcut (visible across all Treatment subsections) */}
        <TouchableOpacity
          style={[
            s.card,
            {
              backgroundColor: theme.surface,
              borderColor: "rgba(16,185,129,0.3)",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginBottom: 4,
            },
          ]}
          onPress={() => router.push("/nearby?type=pharmacy" as any)}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: "rgba(16,185,129,0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="medkit-outline" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cT, { color: theme.textPrimary, fontSize: 13, fontWeight: "700" }]}>
              {t("treatment.findNearestStore", "Find Nearest Medical Store")}
            </Text>
            <Text style={[s.cS, { color: theme.textSecondary, fontSize: 11 }]}>
              {t("treatment.pharmaciesNearYou", "Pharmacies & chemists near you")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* MEDICATIONS */}
        {tab === 0 && (<View style={{ gap: 10 }}>
          {/* Filter tags */}
          <View style={s.fRow}>
            {[
              { id: "active", label: `Active (${dedupeMeds(activeMedsList).length})` },
              { id: "refill", label: `Refill Soon (${dedupeMeds(refillMedsList).length})` },
              { id: "completed", label: `Completed (${dedupeMeds(completedMedsList).length})` },
              { id: "all", label: `All (${dedupeMeds(meds).length})` },
            ].map(f => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  s.tag,
                  { borderColor: theme.surfaceBorder },
                  filter === f.id && { backgroundColor: theme.accentBg, borderColor: theme.accent }
                ]}
              >
                <Text style={[s.tagT, { color: theme.textSecondary }, filter === f.id && { color: theme.accent, fontWeight: "700" }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Yoga AI card */}
          {(() => {
            const activeYoga = yoga || DEFAULT_YOGA;
            return (
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.accent, flexDirection: "row", alignItems: "center", gap: 12 }]}>
                <View style={[s.cI, { borderRadius: 18, width: 36, height: 36, backgroundColor: theme.accentBg }]}>
                  <Ionicons name="body-outline" size={17} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <Ionicons name="sparkles" size={10} color={theme.accent} />
                    <Text style={{ fontSize: 9, letterSpacing: 1, color: theme.accent, fontWeight: "700" }}>
                      {t("treatment.aiRecommendedYoga", "AI RECOMMENDED YOGA")}
                    </Text>
                  </View>
                  <Text style={[s.cT, { color: theme.textPrimary }]}>{activeYoga.title || "Gentle Flow"}</Text>
                  <Text style={[s.cS, { color: theme.textSecondary }]}>{activeYoga.duration || "12 min"} • {activeYoga.level || "Beginner"}</Text>
                </View>
                <TouchableOpacity
                  style={[s.viewBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
                  onPress={() => { if (!getFeatures().yoga_full) { setShowUpgrade(true); return; } setYogaOpen(true); }}
                >
                  <Text style={[s.viewBtnT, { color: theme.textPrimary }]}>{t("treatment.view", "View")}</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Drug & Food Interaction & Do's and Don'ts Card */}
          {drugFoodGuide && drugFoodGuide.has_medications && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[s.card, { borderColor: "rgba(74,222,128,0.4)", backgroundColor: isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.1)" }]}
              onPress={() => setFoodGuideOpen(true)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.cI, { borderRadius: 18, width: 36, height: 36, backgroundColor: "rgba(74,222,128,0.2)" }]}>
                  <Ionicons name="restaurant-outline" size={17} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <Ionicons name="shield-checkmark-outline" size={10} color="#10B981" />
                    <Text style={{ fontSize: 9, letterSpacing: 1, color: "#10B981", fontWeight: "700" }}>DRUG & FOOD CLINICAL GUIDE</Text>
                  </View>
                  <Text style={[s.cT, { color: theme.textPrimary }]}>Food & Medicine Do's & Don'ts</Text>
                  <Text style={[s.cS, { color: theme.textSecondary }]}>{drugFoodGuide.scanned_medications} medicines scanned • Food timing & advice</Text>
                </View>
                <View style={[s.viewBtn, { backgroundColor: "rgba(74,222,128,0.2)", borderColor: "rgba(74,222,128,0.4)" }]}>
                  <Text style={[s.viewBtnT, { color: "#10B981" }]}>{t("treatment.view", "View")}</Text>
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
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSheet(true)}
              style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            >
              <Ionicons name="medical-outline" size={26} color={theme.accent} />
              <Text style={[s.emT, { color: theme.textPrimary }]}>
                {filter === "refill" ? "No refills needed" : filter === "completed" ? "No completed courses" : t("treatment.noMeds", "No medications")}
              </Text>
              <Text style={[s.emS, { color: theme.textSecondary }]}>
                {filter === "refill" ? "All stocks are sufficient" : filter === "completed" ? "Finished medication courses will appear here" : t("treatment.noMedsDesc", "Tap + to add one")}
              </Text>
            </TouchableOpacity>
          ) : (
            fm.map(m => {
              const guide = drugFoodGuide?.guides?.find((g: any) =>
                g.medication?.toLowerCase().includes(m.name?.toLowerCase()) ||
                m.name?.toLowerCase().includes(g.medication?.toLowerCase())
              );
              const isCompleted = m.active === false || m.completed === true;
              return (
                <View key={m.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }, isCompleted && { borderColor: "rgba(74,222,128,0.3)", backgroundColor: isDark ? "rgba(74,222,128,0.04)" : "rgba(74,222,128,0.08)" }]}>
                  <View style={s.cRow}>
                    <View style={[s.cI, { backgroundColor: theme.accentBg }, isCompleted && { backgroundColor: "rgba(74,222,128,0.15)" }]}>
                      <Ionicons name={isCompleted ? "checkmark-done-circle-outline" : "medical-outline"} size={17} color={isCompleted ? "#10B981" : theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cT, { color: theme.textPrimary }]}>{m.name}</Text>
                      {m.generic_name ? <Text style={[s.cS, { color: theme.accent, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                      <Text style={[s.cS, { color: theme.textSecondary }]}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
                      {m.food_relation ? (
                        <View style={{ marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignSelf: "flex-start" }}>
                          <Text style={{ fontSize: 9, color: "#0284C7", fontWeight: "700" }}>
                            {m.food_relation === "before_food" ? "Before Food" : m.food_relation === "with_food" ? "With Food" : m.food_relation === "anytime" ? "Anytime" : "After Food"}
                          </Text>
                        </View>
                      ) : null}
                      {m.notes ? (
                        <Text style={{ fontSize: 10, color: theme.textSecondary, fontStyle: "italic", marginTop: 2 }}>
                          Note: {m.notes}
                        </Text>
                      ) : null}
                    </View>
                    {isCompleted ? (
                      <View style={[s.rTag, { backgroundColor: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.3)" }]}>
                        <Text style={[s.rTx, { color: "#10B981" }]}>Completed</Text>
                      </View>
                    ) : (m.stock <= m.refill_threshold || (m.days_left != null && m.days_left <= 3)) ? (
                      <View style={[s.rTag, { backgroundColor: "rgba(239,68,68,0.15)" }]}><Text style={[s.rTx, { color: "#EF4444" }]}>{m.days_left != null ? `~${m.days_left}d left` : "Refill Soon"}</Text></View>
                    ) : null}
                  </View>
                  {guide?.dos?.[0] && (
                    <View style={{ marginTop: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(74,222,128,0.08)", borderWidth: 1, borderColor: "rgba(74,222,128,0.2)", flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="restaurant-outline" size={11} color="#10B981" />
                      <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "600", flex: 1 }}>{guide.dos[0]}</Text>
                    </View>
                  )}
                  <View style={[s.cFt, { borderTopColor: theme.surfaceBorder }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="time-outline" size={11} color={theme.accent} /><Text style={[s.ftT, { color: theme.textSecondary }]}>{(m.times || []).join(" • ") || "No times set"}</Text></View>
                    <Text style={[s.ftT, { color: theme.textSecondary }]}>{isCompleted ? "Course Finished" : `${m.stock} left`}</Text>
                  </View>

                  {/* Refill / Completion Action Row */}
                  {!isCompleted && m.stock <= m.refill_threshold && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(56,189,248,0.12)", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                        onPress={() => setRefillMed(m)}>
                        <Ionicons name="cube-outline" size={14} color="#0284C7" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#0284C7" }}>Refill Stock</Text>
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
                        <Ionicons name="checkmark-done-circle-outline" size={14} color="#10B981" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>Course Complete</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Completed Course Restart Option */}
                  {isCompleted && (
                    <View style={{ marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: "rgba(74,222,128,0.08)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="checkmark-done-circle" size={14} color="#10B981" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>COURSE COMPLETED</Text>
                      </View>
                      <TouchableOpacity style={{ backgroundColor: "rgba(56,189,248,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                        onPress={() => setRefillMed(m)}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#0284C7" }}>Restart Course</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>)}

        {/* MEASUREMENTS */}
        {tab === 1 && (() => {
          const mTypes = catalog?.m?.length ? catalog.m : DEFAULT_MEASUREMENTS;
          return (
            <View style={{ gap: 10 }}>
              <Text style={[s.secL, { color: theme.textSecondary }]}>LOG A MEASUREMENT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {mTypes.map((mt: any) => (
                  <TouchableOpacity key={mt.key} style={[s.chip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]} onPress={() => openMeasurementModal(mt)}>
                    <Ionicons name="pulse-outline" size={12} color={theme.accent} />
                    <Text style={[s.chipT, { color: theme.textPrimary }]}>{mt.label} <Text style={{ color: theme.textSecondary, fontSize: 10 }}>({mt.unit})</Text></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {measurements.length > 0 ? (
                <>
                  <Text style={[s.secL, { color: theme.textSecondary }]}>RECENT</Text>
                  {measurements.slice(0, 10).map((m: any, i: number) => (
                    <View key={i} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                      <View style={s.cRow}>
                        <View style={[s.cI, { backgroundColor: theme.accentBg }]}><Ionicons name="pulse-outline" size={15} color={theme.accent} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.cT, { color: theme.textPrimary }]}>{m.type?.replace(/_/g, " ")}</Text>
                          <Text style={[s.cS, { color: theme.textSecondary }]}>{new Date(m.recorded_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.accent }}>
                          {m.value}{m.value_secondary ? `/${m.value_secondary}` : ""}
                          <Text style={{ fontSize: 10, color: theme.textSecondary }}> {m.unit}</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Ionicons name="pulse-outline" size={28} color={theme.accent} />
                  <Text style={[s.emT, { color: theme.textPrimary }]}>No measurements yet</Text>
                  <Text style={[s.emS, { color: theme.textSecondary }]}>Tap a category above to log one</Text>
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
              <Text style={[s.secL, { color: theme.textSecondary }]}>LOG AN ACTIVITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {aTypes.map((at: any) => (
                  <TouchableOpacity key={at.key} style={[s.chip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]} onPress={() => openActivityModal(at)}>
                    <Ionicons name="body-outline" size={12} color={theme.accent} />
                    <Text style={[s.chipT, { color: theme.textPrimary }]}>{at.label} <Text style={{ color: theme.textSecondary, fontSize: 10 }}>({at.unit})</Text></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {activities.length > 0 ? (
                <>
                  <Text style={[s.secL, { color: theme.textSecondary }]}>RECENT</Text>
                  {activities.slice(0, 10).map((a: any, i: number) => (
                    <View key={i} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                      <View style={s.cRow}>
                        <View style={[s.cI, { backgroundColor: theme.accentBg }]}><Ionicons name="body-outline" size={15} color={theme.accent} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.cT, { color: theme.textPrimary }]}>{a.type?.replace(/_/g, " ")}</Text>
                          <Text style={[s.cS, { color: theme.textSecondary }]}>{new Date(a.recorded_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.accent }}>{a.value}<Text style={{ fontSize: 10, color: theme.textSecondary }}> {a.unit}</Text></Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Ionicons name="body-outline" size={28} color={theme.accent} />
                  <Text style={[s.emT, { color: theme.textPrimary }]}>No activities yet</Text>
                  <Text style={[s.emS, { color: theme.textSecondary }]}>Tap a category above to log one</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* MOOD */}
        {tab === 3 && (<View style={{ gap: 10 }}>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[s.cT, { color: theme.textPrimary }]}>How are you feeling today?</Text>
            <View style={s.mRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setMs(n)} style={[s.mBtn, { borderColor: theme.surfaceBorder }, ms === n && { borderColor: MC[n], backgroundColor: `${MC[n]}22` }]}>
                  <Text style={{ fontSize: 22 }}>{ME[n]}</Text>
                  <Text style={[s.mNum, { color: theme.textSecondary }, ms === n && { color: MC[n] }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={mn}
              onChangeText={setMn}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.textDisabled}
              style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
              multiline
            />
            <TouchableOpacity style={[s.subBtn, { backgroundColor: theme.accent }]} onPress={saveMood} disabled={saving}>
              <Text style={s.subT}>{saving ? "Saving…" : "Log Mood"}</Text>
            </TouchableOpacity>
          </View>
          {mood.length > 0 && (
            <>
              <Text style={[s.secL, { color: theme.textSecondary }]}>Recent Logs</Text>
              {mood.slice(0, 6).map((m: any, i: number) => (
                <View key={i} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, flexDirection: "row", alignItems: "center", gap: 12 }]}>
                  <Text style={{ fontSize: 24 }}>{ME[m.score] || "😐"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cT, { color: theme.textPrimary }]}>Mood {m.score}/5 ({MOOD_LABELS[m.score] || "Neutral"})</Text>
                    <Text style={[s.cS, { color: theme.textSecondary }]}>{new Date(m.recorded_at).toLocaleDateString()}</Text>
                  </View>
                  {m.note && <Text style={[s.cS, { color: theme.textSecondary, maxWidth: 100, textAlign: "right" }]}>{m.note}</Text>}
                </View>
              ))}
            </>
          )}
        </View>)}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setSheet(true)}>
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Action Sheet */}
      <ActionSheetModal
        visible={sheet}
        onClose={() => setSheet(false)}
        options={OPTS}
      />

      {/* Yoga Detail Modal */}
      <Modal visible={yogaOpen} transparent animationType="slide" onRequestClose={() => setYogaOpen(false)}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setYogaOpen(false)}>
          <View style={[s.sBox, { backgroundColor: theme.surface, maxHeight: "92%" }]}>
            {/* Header row with close X */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={10} color={theme.accent} />
                <Text style={{ fontSize: 9, letterSpacing: 1, color: theme.accent, fontWeight: "700" }}>
                  {t("treatment.aiRecommendedYoga", "AI RECOMMENDED YOGA")}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setYogaOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[s.sTitle, { color: theme.textPrimary }]}>{yoga?.title || "Gentle Flow"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={[s.chip, { backgroundColor: theme.accentBg, borderColor: theme.accent }]}><Ionicons name="time-outline" size={11} color={theme.accent} /><Text style={[s.chipT, { color: theme.accent }]}>{yoga?.duration || "12 min"}</Text></View>
              <View style={[s.chip, { backgroundColor: theme.accentBg, borderColor: theme.accent }]}><Ionicons name="speedometer-outline" size={11} color={theme.accent} /><Text style={[s.chipT, { color: theme.accent }]}>{yoga?.level || "Beginner"}</Text></View>
            </View>
            <Text style={[s.cS, { color: theme.textSecondary, lineHeight: 17 }]}>{yoga?.description || ""}</Text>
            <Text style={[s.secL, { color: theme.textSecondary, marginTop: 4 }]}>ROUTINE · {safeCompletedSteps.length}/{(yoga?.steps || []).length} done today</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(yoga?.steps || []).map((step: any) => {
                const stepDone = isStepDone(step.num);
                return (
                  <View key={step.num} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, gap: 8, marginBottom: 8 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.cI, { borderRadius: 13, backgroundColor: theme.accentBg }, stepDone && { backgroundColor: "rgba(74,222,128,0.18)" }]}>
                        {stepDone ? <Ionicons name="checkmark" size={14} color="#10B981" /> : <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700" }}>{step.num}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cT, { color: theme.textPrimary }]}>{step.name}</Text>
                        <Text style={[s.cS, { color: theme.textSecondary }]}>{step.duration}</Text>
                        {step.benefit ? <Text style={[s.cS, { color: theme.accent, marginTop: 2 }]}>{step.benefit}</Text> : null}
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
                      <Text style={{ fontSize: 11, color: theme.textPrimary, flex: 1, fontWeight: "700" }}>Watch Inside App</Text>
                      <Text style={{ fontSize: 9, color: theme.accent, fontWeight: "600" }}>{step.channel || "Swami Ramdev"}</Text>
                      <Ionicons name="chevron-forward" size={12} color={theme.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, backgroundColor: stepDone ? "rgba(74,222,128,0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"), borderRadius: 8, padding: 8, borderWidth: 1, borderColor: stepDone ? "rgba(74,222,128,0.3)" : theme.surfaceBorder }}
                      onPress={() => toggleStepDone(step)}>
                      <Ionicons name={stepDone ? "checkmark-circle" : "ellipse-outline"} size={14} color={stepDone ? "#10B981" : theme.textSecondary} />
                      <Text style={{ fontSize: 10, color: stepDone ? "#10B981" : theme.textSecondary, fontWeight: "600" }}>{stepDone ? "Marked as Done" : "Mark as Done"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <Text style={[s.secL, { color: theme.textSecondary, marginTop: 10, marginBottom: 8 }]}>VERIFIED SOURCES</Text>
              {(yoga?.channels || [
                { name: "Ministry of AYUSH, Govt. of India", url: "https://www.youtube.com/@ministryofayushofficial", verified: true },
                { name: "Swami Ramdev — Patanjali Yogpeeth", url: "https://www.youtube.com/@SwamiRamdevOfficial", verified: true },
                { name: "Sadhguru — Isha Foundation (Padma Vibhushan, UN recognised)", url: "https://www.youtube.com/@sadhguru", verified: true },
              ]).map((ch: any) => (
                <TouchableOpacity key={ch.url}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.surfaceBorder }}
                  onPress={() => Linking.openURL(ch.url)}>
                  <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                  <Text style={{ fontSize: 11, color: theme.textPrimary, flex: 1 }}>{ch.name}</Text>
                  {ch.verified && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(74,222,128,0.15)", borderRadius: 4 }}>
                    <Text style={{ fontSize: 8, color: "#10B981", fontWeight: "700" }}>✓ VERIFIED</Text>
                  </View>}
                </TouchableOpacity>
              ))}
              <Text style={[s.cS, { color: theme.textSecondary, fontStyle: "italic", marginTop: 10, marginBottom: 12, lineHeight: 15 }]}>{yoga?.disclaimer || ""}</Text>
            </ScrollView>
            {/* Reminder button */}
            {savedReminderTime ? (
              <TouchableOpacity
                style={[s.subBtn, { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.3)", borderWidth: 1 }]}
                onPress={() => {
                  setYogaOpen(false);
                  setTimeout(() => setYogaTimePicker(true), 350);
                }}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[s.subT, { color: "#10B981" }]}>
                  {"Daily reminder at " + savedReminderTime + "  —  Edit"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.subBtn, { backgroundColor: theme.accent, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }]}
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
          onChange={(evt, selected) => {
            setYogaTimePicker(false);
            if ((Platform.OS === "ios" || evt.type === "set") && selected) scheduleYogaReminder(selected);
          }}
        />
      )}

      {/* Measurement Modal */}
      <Modal visible={mModal.open} transparent animationType="slide" onRequestClose={() => setMModal({ open: false, type: null })}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setMModal({ open: false, type: null })}>
          <View style={[s.sBox, { backgroundColor: theme.surface }]}>
            <View style={s.hand} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[s.sTitle, { color: theme.textPrimary }]}>Log {mModal.type?.label}</Text>
              <TouchableOpacity onPress={() => setMModal({ open: false, type: null })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 2 }}>
              <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>Unit:</Text>
              {(mModal.type?.units || [mModal.type?.unit || ""]).map((u: string) => (
                <TouchableOpacity key={u} onPress={() => setSelectedMUnit(u)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: selectedMUnit === u ? theme.accentBg : theme.surface, borderWidth: 1, borderColor: selectedMUnit === u ? theme.accent : theme.surfaceBorder }}>
                  <Text style={{ fontSize: 11, color: selectedMUnit === u ? theme.accent : theme.textSecondary, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mModal.type?.composite || mModal.type?.key === "blood_pressure" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "600" }}>Systolic (Upper number, e.g. 120)</Text>
                  <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder="120" placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "600" }}>Diastolic (Lower number, e.g. 80)</Text>
                  <TextInput value={vS} onChangeText={setVS} keyboardType="decimal-pad" placeholder="80" placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "600" }}>Value ({selectedMUnit || mModal.type?.unit})</Text>
                <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder={`Enter value in ${selectedMUnit || mModal.type?.unit || ""}`} placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
              </View>
            )}
            <TextInput value={vN} onChangeText={setVN} placeholder="Notes / Observations (optional)" placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
            <TouchableOpacity style={[s.subBtn, { backgroundColor: theme.accent, opacity: (!vP.trim() || saving) ? 0.6 : 1 }]} onPress={saveMeasure} disabled={saving}><Text style={s.subT}>{saving ? "Saving…" : "Save Measurement"}</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 10, alignItems: "center" }} onPress={() => setMModal({ open: false, type: null })}><Text style={{ color: theme.textSecondary }}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={aModal.open} transparent animationType="slide" onRequestClose={() => setAModal({ open: false, type: null })}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setAModal({ open: false, type: null })}>
          <View style={[s.sBox, { backgroundColor: theme.surface }]}>
            <View style={s.hand} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[s.sTitle, { color: theme.textPrimary }]}>Log {aModal.type?.label}</Text>
              <TouchableOpacity onPress={() => setAModal({ open: false, type: null })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginVertical: 2 }}>
              <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>Unit:</Text>
              {(aModal.type?.units || [aModal.type?.unit || ""]).map((u: string) => (
                <TouchableOpacity key={u} onPress={() => setSelectedAUnit(u)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: selectedAUnit === u ? theme.accentBg : theme.surface, borderWidth: 1, borderColor: selectedAUnit === u ? theme.accent : theme.surfaceBorder }}>
                  <Text style={{ fontSize: 11, color: selectedAUnit === u ? theme.accent : theme.textSecondary, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "600" }}>Value ({selectedAUnit || aModal.type?.unit})</Text>
              <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder={`Enter amount in ${selectedAUnit || aModal.type?.unit || ""}`} placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
            </View>
            <TextInput value={vN} onChangeText={setVN} placeholder="Notes (optional)" placeholderTextColor={theme.textDisabled} style={[s.inp, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", color: theme.textPrimary, borderColor: theme.surfaceBorder }]} />
            <TouchableOpacity style={[s.subBtn, { backgroundColor: theme.accent, opacity: (!vP.trim() || saving) ? 0.6 : 1 }]} onPress={saveActivity} disabled={saving}><Text style={s.subT}>{saving ? "Saving…" : "Save Activity"}</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 10, alignItems: "center" }} onPress={() => setAModal({ open: false, type: null })}><Text style={{ color: theme.textSecondary }}>Cancel</Text></TouchableOpacity>
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
            toggleStepDone(activeVideo.step, true);
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
