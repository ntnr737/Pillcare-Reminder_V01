import { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Linking, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";
import { resyncReminders } from "@/src/lib/notifications";
import { get, set, K } from "@/src/lib/store";
import { backgroundRefresh } from "@/src/lib/sync";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";
const TABS = ["Medications", "Measurements", "Activities", "Mood"];
const ME = ["", "😟", "😔", "😐", "😊", "😄"];
const MC = ["", "#e58585", "#e5b285", "#a7a1db", "#85c1e5", "#85e5a5"];

export default function Treatment() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("all");
  const [meds, setMeds] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [mood, setMood] = useState<any[]>([]);
  const [yoga, setYoga] = useState<any>(null);
  const [yogaOpen, setYogaOpen] = useState(false);
  const trackYogaView = () => track("yoga_viewed");
  const [yogaTimePicker, setYogaTimePicker] = useState(false);
  const [yogaTime, setYogaTime] = useState<Date | null>(null);
  const [savedReminderTime, setSavedReminderTime] = useState<string | null>(null);

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
  const [ms, setMs] = useState(3);
  const [mn, setMn] = useState("");
  const [vP, setVP] = useState("");
  const [vS, setVS] = useState("");
  const [vN, setVN] = useState("");
  const [saving, setSaving] = useState(false);

  // Load cache instantly
  const loadCache = useCallback(async () => {
    get<any[]>(K.medications).then(m => { if (m) setMeds(m); });
    get<any[]>(K.measurements).then(m => { if (m) setMeasurements(m); });
    get<any[]>(K.mood).then(m => { if (m) setMood(m); });
    get<any>(K.yogaTip).then(y => { if (y) setYoga(y); });
  }, []);

  const loadServer = useCallback(async () => {
    try {
      const [m, mes, act, mo, mc, ac, y] = await Promise.all([
        api.listMedications(true), api.listMeasurements(), api.listActivities(),
        api.listMood(), api.measurementCatalog(), api.activityCatalog(), api.yogaTip()
      ]);
      setMeds(m); setMeasurements(mes); setActivities(act); setMood(mo);
      setCatalog({ m: mc.measurements, a: ac.activities }); setYoga(y);
      set(K.medications, m); set(K.measurements, mes); set(K.mood, mo); set(K.yogaTip, y);
      resyncReminders().catch(() => {});
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadCache();
    backgroundRefresh(loadServer);
  }, [loadCache, loadServer]));

  const saveMeasure = async () => {
    if (!mModal.type || !vP) return; setSaving(true);
    try { await api.createMeasurement({ type: mModal.type.key, value: parseFloat(vP), value_secondary: vS ? parseFloat(vS) : undefined, unit: mModal.type.unit, note: vN || undefined }); setMModal({ open: false, type: null }); setVP(""); setVS(""); setVN(""); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };
  const saveActivity = async () => {
    if (!aModal.type || !vP) return; setSaving(true);
    try { await api.createActivity({ type: aModal.type.key, value: parseFloat(vP), unit: aModal.type.unit, note: vN || undefined }); setAModal({ open: false, type: null }); setVP(""); setVN(""); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };
  const saveMood = async () => {
    setSaving(true);
    try { await api.createMood({ score: ms, note: mn || undefined }); setMn(""); setMs(3); backgroundRefresh(loadServer); } catch {} finally { setSaving(false); }
  };

  const fm = filter === "refill" ? meds.filter(m => m.stock <= m.refill_threshold) : filter === "active" ? meds.filter(m => m.active !== false) : meds;
  const OPTS = [
    { icon: "medical-outline", title: "Add Medication", body: "Add a new medication to your routine", fn: () => { setSheet(false); setAddMed(true); } },
    { icon: "calendar-outline", title: "Book Appointment", body: "Schedule a doctor appointment", fn: () => { setSheet(false); router.push("/appointments"); } },
    { icon: "pulse-outline", title: "Log Measurement", body: "Blood pressure, glucose, weight...", fn: () => { setSheet(false); if (catalog?.m?.[0]) setMModal({ open: true, type: catalog.m[0] }); } },
    { icon: "body-outline", title: "Log Activity", body: "Steps, exercise, walking...", fn: () => { setSheet(false); if (catalog?.a?.[0]) setAModal({ open: true, type: catalog.a[0] }); } },
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
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.getHours(),
          minute: time.getMinutes(),
          channelId: "medication-reminders",
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
      Alert.alert("Yoga Reminder Set", `Daily reminder set for ${h}:${m}`);
    } catch {
      Alert.alert("Error", "Could not set yoga reminder. Please try again.");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}><Text style={s.title}>Treatment</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS.map((t, i) => (<TouchableOpacity key={t} onPress={() => setTab(i)} style={[s.tab, i === tab && s.tabOn]}><Text style={[s.tabT, i === tab && s.tabTOn]}>{t}</Text></TouchableOpacity>))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* MEDICATIONS */}
        {tab === 0 && (<View style={{ gap: 10 }}>
          {/* Filter tags - above yoga card so yoga doesn't shift */}
          <View style={s.fRow}>
            {["all", "active", "refill"].map(f => (<TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.tag, filter === f && s.tagOn]}><Text style={[s.tagT, filter === f && s.tagTOn]}>{f === "all" ? `All (${meds.length})` : f === "active" ? "Active" : "Refill Soon"}</Text></TouchableOpacity>))}
          </View>

          {/* Yoga AI card - fixed position, not affected by filter */}
          {yoga && (<View style={[s.card, { borderColor: "rgba(145,132,217,0.3)", flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <View style={[s.cI, { borderRadius: 18, width: 36, height: 36 }]}><Ionicons name="body-outline" size={17} color={A3} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}><Ionicons name="sparkles" size={10} color={A3} /><Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDED YOGA</Text></View>
              <Text style={s.cT}>{yoga.title || "Gentle Flow"}</Text>
              <Text style={s.cS}>{yoga.duration || "12 min"} • {yoga.level || "Beginner"}</Text>
            </View>
            <TouchableOpacity style={s.viewBtn} onPress={() => setYogaOpen(true)}><Text style={s.viewBtnT}>View</Text></TouchableOpacity>
          </View>)}
          {fm.length === 0 ? (<View style={s.empty}><Ionicons name="medical-outline" size={26} color={AC} /><Text style={s.emT}>{filter === "refill" ? "No refills needed" : "No medications"}</Text><Text style={s.emS}>{filter === "refill" ? "All stocks are sufficient" : "Tap + to add one"}</Text></View>
          ) : fm.map(m => (<View key={m.id} style={s.card}>
            <View style={s.cRow}>
              <View style={s.cI}><Ionicons name="medical-outline" size={17} color={A3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cT}>{m.name}</Text>
                {m.generic_name ? <Text style={[s.cS, { color: A3, fontStyle: "italic" }]}>Generic: {m.generic_name}</Text> : null}
                <Text style={s.cS}>{m.dosage ? `${m.dosage} ${m.unit}` : m.unit || ""}</Text>
              </View>
              {m.stock <= m.refill_threshold && <View style={s.rTag}><Text style={s.rTx}>Refill Soon</Text></View>}
            </View>
            <View style={s.cFt}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name="time-outline" size={11} color={A3} /><Text style={s.ftT}>{(m.times || []).join(" • ") || "No times set"}</Text></View>
              <Text style={s.ftT}>{m.stock} left</Text>
            </View>
          </View>))}
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
        {tab === 1 && (<View style={{ gap: 10 }}>
          <Text style={s.secL}>Log a measurement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {(catalog?.m || []).map((mt: any) => (<TouchableOpacity key={mt.key} style={s.chip} onPress={() => { setMModal({ open: true, type: mt }); setVP(""); setVS(""); setVN(""); }}><Ionicons name="pulse-outline" size={12} color={A3} /><Text style={s.chipT}>{mt.label}</Text></TouchableOpacity>))}
          </ScrollView>
          {measurements.length > 0 ? (<><Text style={s.secL}>Recent</Text>{measurements.slice(0, 10).map((m: any, i: number) => (<View key={i} style={s.card}><View style={s.cRow}><View style={s.cI}><Ionicons name="pulse-outline" size={15} color={A3} /></View><View style={{ flex: 1 }}><Text style={s.cT}>{m.type?.replace(/_/g, " ")}</Text><Text style={s.cS}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View><Text style={{ fontSize: 16, fontWeight: "700", color: A3 }}>{m.value}{m.value_secondary ? `/${m.value_secondary}` : ""}<Text style={{ fontSize: 10, color: TM }}> {m.unit}</Text></Text></View></View>))}</>) : (<View style={s.empty}><Ionicons name="pulse-outline" size={28} color={AC} /><Text style={s.emT}>No measurements yet</Text><Text style={s.emS}>Tap a category above to log one</Text></View>)}
        </View>)}

        {/* ACTIVITIES */}
        {tab === 2 && (<View style={{ gap: 10 }}>
          <Text style={s.secL}>Log an activity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {(catalog?.a || []).map((at: any) => (<TouchableOpacity key={at.key} style={s.chip} onPress={() => { setAModal({ open: true, type: at }); setVP(""); setVN(""); }}><Ionicons name="body-outline" size={12} color={A3} /><Text style={s.chipT}>{at.label}</Text></TouchableOpacity>))}
          </ScrollView>
          {activities.length > 0 ? (<><Text style={s.secL}>Recent</Text>{activities.slice(0, 10).map((a: any, i: number) => (<View key={i} style={s.card}><View style={s.cRow}><View style={s.cI}><Ionicons name="body-outline" size={15} color={A3} /></View><View style={{ flex: 1 }}><Text style={s.cT}>{a.type?.replace(/_/g, " ")}</Text><Text style={s.cS}>{new Date(a.recorded_at).toLocaleDateString()}</Text></View><Text style={{ fontSize: 16, fontWeight: "700", color: A3 }}>{a.value}<Text style={{ fontSize: 10, color: TM }}> {a.unit}</Text></Text></View></View>))}</>) : (<View style={s.empty}><Ionicons name="body-outline" size={28} color={AC} /><Text style={s.emT}>No activities yet</Text><Text style={s.emS}>Tap a category above to log one</Text></View>)}
        </View>)}

        {/* MOOD */}
        {tab === 3 && (<View style={{ gap: 10 }}>
          <View style={s.card}>
            <Text style={s.cT}>How are you feeling?</Text>
            <View style={s.mRow}>{[1, 2, 3, 4, 5].map(n => (<TouchableOpacity key={n} onPress={() => setMs(n)} style={[s.mBtn, ms === n && { borderColor: MC[n], backgroundColor: `${MC[n]}22` }]}><Text style={{ fontSize: 22 }}>{ME[n]}</Text><Text style={[s.mNum, ms === n && { color: MC[n] }]}>{n}</Text></TouchableOpacity>))}</View>
            <TextInput value={mn} onChangeText={setMn} placeholder="Add a note (optional)" placeholderTextColor={TM} style={s.inp} multiline />
            <TouchableOpacity style={s.subBtn} onPress={saveMood} disabled={saving}><Text style={s.subT}>{saving ? "Saving…" : "Log Mood"}</Text></TouchableOpacity>
          </View>
          {mood.length > 0 && (<><Text style={s.secL}>Recent</Text>{mood.slice(0, 6).map((m: any, i: number) => (<View key={i} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}><Text style={{ fontSize: 24 }}>{ME[m.score] || "😐"}</Text><View style={{ flex: 1 }}><Text style={s.cT}>Mood {m.score}/5</Text><Text style={s.cS}>{new Date(m.recorded_at).toLocaleDateString()}</Text></View>{m.note && <Text style={[s.cS, { maxWidth: 100, textAlign: "right" }]}>{m.note}</Text>}</View>))}</>)}
        </View>)}
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={() => setSheet(true)}><Ionicons name="add" size={24} color={BG} /></TouchableOpacity>

      {/* Action Sheet */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setSheet(false)}>
          <View style={s.sBox}><View style={s.hand} /><Text style={s.sTitle}>What would you like to do?</Text>
            {OPTS.map(o => (<TouchableOpacity key={o.title} style={s.sOpt} onPress={o.fn}><View style={s.cI}><Ionicons name={o.icon as any} size={17} color={TX} /></View><View style={{ flex: 1 }}><Text style={s.cT}>{o.title}</Text><Text style={s.cS}>{o.body}</Text></View><Ionicons name="chevron-forward" size={14} color={TM} /></TouchableOpacity>))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Yoga Detail Modal */}
      <Modal visible={yogaOpen} transparent animationType="slide" onRequestClose={() => setYogaOpen(false)}>
        {/* No TouchableOpacity backdrop — modal stays open on outside tap */}
        <View style={s.ovl}>
          <View style={[s.sBox, { maxHeight: "92%" }]}>
            {/* Header row with close X */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={10} color={A3} />
                <Text style={{ fontSize: 9, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDED YOGA</Text>
              </View>
              <TouchableOpacity onPress={() => setYogaOpen(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(233,233,237,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={16} color={TM} />
              </TouchableOpacity>
            </View>
            <Text style={s.sTitle}>{yoga?.title || "Gentle Flow"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={s.chip}><Ionicons name="time-outline" size={11} color={A3} /><Text style={s.chipT}>{yoga?.duration || "12 min"}</Text></View>
              <View style={s.chip}><Ionicons name="speedometer-outline" size={11} color={A3} /><Text style={s.chipT}>{yoga?.level || "Beginner"}</Text></View>
            </View>
            <Text style={[s.cS, { lineHeight: 17 }]}>{yoga?.description || ""}</Text>
            <Text style={[s.secL, { marginTop: 4 }]}>ROUTINE</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(yoga?.steps || []).map((step: any) => (
                <View key={step.num} style={[s.card, { gap: 8, marginBottom: 8 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[s.cI, { borderRadius: 13 }]}><Text style={{ fontSize: 11, color: A3, fontWeight: "700" }}>{step.num}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cT}>{step.name}</Text>
                      <Text style={s.cS}>{step.duration}</Text>
                      {step.benefit ? <Text style={[s.cS, { color: A3, marginTop: 2 }]}>{step.benefit}</Text> : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,0,0,0.08)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "rgba(255,0,0,0.15)" }}
                    onPress={() => Linking.openURL(step.youtube_video || step.youtube_channel || "https://www.youtube.com/watch?v=QPjwawKxuLw")}>
                    <Ionicons name="logo-youtube" size={14} color="#FF0000" />
                    <Text style={{ fontSize: 10, color: TX, flex: 1 }}>Watch on YouTube</Text>
                    <Text style={{ fontSize: 9, color: A3, fontWeight: "600" }}>{step.channel || "Swami Ramdev"}</Text>
                    <Ionicons name="open-outline" size={10} color={TM} />
                  </TouchableOpacity>
                </View>
              ))}
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
        </View>
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
        <View style={s.ovl}><View style={s.sBox}><View style={s.hand} />
          <Text style={s.sTitle}>{mModal.type?.label}</Text><Text style={s.cS}>Unit: {mModal.type?.unit}</Text>
          <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder={mModal.type?.composite ? `${mModal.type.composite[0]} value` : "Value"} placeholderTextColor={TM} style={s.inp} />
          {mModal.type?.composite && <TextInput value={vS} onChangeText={setVS} keyboardType="decimal-pad" placeholder={`${mModal.type.composite[1]} value`} placeholderTextColor={TM} style={s.inp} />}
          <TextInput value={vN} onChangeText={setVN} placeholder="Note (optional)" placeholderTextColor={TM} style={s.inp} />
          <TouchableOpacity style={s.subBtn} onPress={saveMeasure} disabled={saving || !vP}><Text style={s.subT}>{saving ? "Saving…" : "Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setMModal({ open: false, type: null })}><Text style={{ color: TM }}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={aModal.open} transparent animationType="slide" onRequestClose={() => setAModal({ open: false, type: null })}>
        <View style={s.ovl}><View style={s.sBox}><View style={s.hand} />
          <Text style={s.sTitle}>{aModal.type?.label}</Text><Text style={s.cS}>Unit: {aModal.type?.unit}</Text>
          <TextInput value={vP} onChangeText={setVP} keyboardType="decimal-pad" placeholder="Value" placeholderTextColor={TM} style={s.inp} />
          <TextInput value={vN} onChangeText={setVN} placeholder="Note (optional)" placeholderTextColor={TM} style={s.inp} />
          <TouchableOpacity style={s.subBtn} onPress={saveActivity} disabled={saving || !vP}><Text style={s.subT}>{saving ? "Saving…" : "Save"}</Text></TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setAModal({ open: false, type: null })}><Text style={{ color: TM }}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={() => { setAddMed(false); backgroundRefresh(loadServer); }} />
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
  sBox: { backgroundColor: N8, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12 },
  hand: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }, sTitle: { fontSize: 16, fontWeight: "700", color: TX },
  sOpt: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: SF, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: BD },
  empty: { backgroundColor: SF, borderRadius: 14, padding: 32, alignItems: "center", gap: 8, borderWidth: 1, borderColor: BD }, emT: { fontSize: 14, fontWeight: "700", color: TX }, emS: { fontSize: 12, color: TM, textAlign: "center" },
});
