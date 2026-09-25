import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";
import * as Notifications from "expo-notifications";
import { get, set } from "@/src/lib/store";
import { getFeatures } from "@/src/lib/features";
import { UpgradePrompt } from "@/src/components/UpgradePrompt";

type Appt = {
  id?: string; doctor_name: string; specialty?: string; phone?: string;
  date: string; time: string; location?: string; notes?: string; reminder?: string;
};

const BLANK: Appt = { doctor_name: "", specialty: "", phone: "", date: "", time: "", location: "", notes: "", reminder: "1_day" };

export default function Appointments() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [appts, setAppts] = useState<Appt[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Appt>(BLANK);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const getPickerDate = () => {
    try {
      if (editing.date) {
        const [y, m, d] = editing.date.split("-").map(Number);
        const [h, min] = editing.time ? editing.time.split(":").map(Number) : [9, 0];
        return new Date(y, m - 1, d, h || 9, min || 0);
      }
    } catch {}
    return new Date();
  };

  const load = useCallback(async () => {
    try {
      const data = await api.listAppointments();
      setAppts(data || []);
      set("appointments", data || []);
    } catch {
      const cached = await get<Appt[]>("appointments");
      if (cached) setAppts(cached);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!editing.doctor_name.trim()) {
      Alert.alert(t("common.error", "Error"), t("appointments.doctorNameRequired", "Doctor name is required.")); return;
    }
    if (!editing.date || !editing.time) {
      Alert.alert(t("common.error", "Error"), t("appointments.dateTimeRequired", "Please select a date and time for the appointment.")); return;
    }
    setSaving(true);
    try {
      let saved;
      if (editing.id) {
        saved = await api.updateAppointment(editing.id, editing);
      } else {
        saved = await api.createAppointment(editing);
      }
      const apptIdForNotif = saved?.id || editing.id;
      if (apptIdForNotif) {
        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          const stale = scheduled.filter(n => n.content.data?.appointmentId === apptIdForNotif);
          await Promise.all(stale.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
        } catch {}
      }
      if (editing.date && editing.time && editing.reminder !== "none") {
        const [y, mo, d] = editing.date.split("-").map(Number);
        const [h, min] = editing.time.split(":").map(Number);
        const apptDate = new Date(y, mo - 1, d, h, min, 0);
        const offsets: Record<string, number> = { "1_day": 86400000, "2_hours": 7200000 };
        const offset = offsets[editing.reminder || "1_day"] || 86400000;
        const notifTime = new Date(apptDate.getTime() - offset);
        if (notifTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: t("appointments.reminderTitle", "Appointment reminder"),
              body: `Dr. ${editing.doctor_name}${editing.specialty ? " — " + editing.specialty : ""} at ${editing.time}`,
              data: { appointmentId: saved?.id || "" },
              sound: "pillcare_reminder",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notifTime,
              channelId: "medication-reminders",
            },
          });
        }
      }
      track("appointment_saved"); setModal(false); setEditing(BLANK); load();
    } catch (e: any) {
      const msg = e?.message || "Unknown error";
      console.error("Appointment save error:", msg);
      Alert.alert("ERR_3001", `Could not save appointment. ${msg.includes("ERR_") ? msg : "Check your connection and try again."}`);
    }
    finally { setSaving(false); }
  };

  const deleteAppt = (id: string) => {
    Alert.alert(t("common.delete", "Delete"), t("appointments.deleteConfirm", "Remove this appointment?"), [
      { text: t("common.cancel", "Cancel"), style: "cancel" },
      { text: t("common.delete", "Delete"), style: "destructive", onPress: async () => {
        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          const stale = scheduled.filter(n => n.content.data?.appointmentId === id);
          await Promise.all(stale.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
        } catch {}
        await api.deleteAppointment(id); load();
      } }
    ]);
  };

  const addToCalendar = async (appt: Appt) => {
    try {
      const [year, month, day] = appt.date.split("-").map(Number);
      const [hour, min] = appt.time.split(":").map(Number);
      const start = new Date(year, month - 1, day, hour, min);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const title = encodeURIComponent(`Dr. ${appt.doctor_name} — PillCare`);
      const details = encodeURIComponent([appt.specialty, appt.notes].filter(Boolean).join("\n"));
      const location = encodeURIComponent(appt.location || "");
      const url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("appointments.calendarErr", "Could not open calendar"), t("appointments.calendarErrDesc", "Please add this appointment manually to your calendar."));
    }
  };

  const upcoming = appts.filter(a => a.date >= new Date().toISOString().slice(0, 10));
  const past = appts.filter(a => a.date < new Date().toISOString().slice(0, 10));

  const formatDate = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const inputStyle = [
    s.inp,
    {
      backgroundColor: isDark ? "#1e2030" : "#f8fafc",
      color: theme.textPrimary,
      borderColor: theme.surfaceBorder,
    },
  ];

  const ApptCard = ({ appt }: { appt: Appt }) => (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <View style={s.cRow}>
        <View style={[s.cI, { backgroundColor: theme.accentBg }]}><Ionicons name="medical-outline" size={17} color={theme.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.cT, { color: theme.textPrimary }]}>Dr. {appt.doctor_name}</Text>
          {appt.specialty ? <Text style={[s.cS, { color: theme.accent }]}>{appt.specialty}</Text> : null}
          <Text style={[s.cS, { color: theme.textSecondary }]}>{formatDate(appt.date)} at {appt.time}</Text>
          {appt.location ? <Text style={[s.cS, { color: theme.textSecondary }]}>{appt.location}</Text> : null}
        </View>
      </View>
      <View style={[s.cardActions, { borderTopColor: theme.surfaceBorder }]}>
        {appt.phone ? (
          <TouchableOpacity style={[s.actionBtn, { borderColor: theme.surfaceBorder }]} onPress={() => { const ph = (appt.phone||'').replace(/[\s\-()]/g,''); if(ph) Linking.openURL(`tel:${ph}`); }}>
            <Ionicons name="call" size={13} color="#4ade80" />
            <Text style={[s.actionTx, { color: "#4ade80" }]}>{t("common.call", "Call")}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[s.actionBtn, { borderColor: theme.surfaceBorder }]} onPress={() => addToCalendar(appt)}>
          <Ionicons name="calendar" size={13} color={theme.accent} />
          <Text style={[s.actionTx, { color: theme.accent }]}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { borderColor: theme.surfaceBorder }]} onPress={() => { setEditing(appt); setModal(true); }}>
          <Ionicons name="pencil" size={13} color={theme.textSecondary} />
          <Text style={[s.actionTx, { color: theme.textSecondary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { borderColor: theme.surfaceBorder }]} onPress={() => appt.id && deleteAppt(appt.id)}>
          <Ionicons name="trash" size={13} color="#e58585" />
          <Text style={[s.actionTx, { color: "#e58585" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      {appt.notes ? <Text style={[s.cS, { color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }]}>{appt.notes}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={[s.hdr, { borderBottomColor: theme.surfaceBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.textPrimary }]}>{t("appointments.title", "Doctor Appointments")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, alignItems: "center", padding: 32 }]}><Text style={{ color: theme.textSecondary }}>{t("common.loading", "Loading…")}</Text></View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <><Text style={[s.secL, { color: theme.textSecondary }]}>UPCOMING</Text>{upcoming.map((a, i) => <ApptCard key={a.id || i} appt={a} />)}</>
            )}
            {past.length > 0 && (
              <><Text style={[s.secL, { color: theme.textSecondary }]}>PAST</Text>{past.map((a, i) => <ApptCard key={a.id || i} appt={a} />)}</>
            )}
            {appts.length === 0 && (
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, alignItems: "center", padding: 40, gap: 10 }]}>
                <View style={[s.cI, { backgroundColor: theme.accentBg, width: 52, height: 52, borderRadius: 26 }]}>
                  <Ionicons name="calendar-outline" size={26} color={theme.accent} />
                </View>
                <Text style={[s.cT, { color: theme.textPrimary }]}>{t("appointments.noAppointments", "No appointments yet")}</Text>
                <Text style={[s.cS, { color: theme.textSecondary }]}>{t("appointments.noAppointmentsDesc", "Tap + to add your first doctor appointment")}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => { if (appts.length >= getFeatures().max_appointments) { setShowUpgrade(true); return; } setEditing(BLANK); setModal(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={() => setModal(false)}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={[s.sheet, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={[s.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={[s.sheetT, { color: theme.textPrimary }]}>{editing.id ? t("appointments.editTitle", "Edit Appointment") : t("appointments.bookTitle", "Book Appointment")}</Text>
                <TouchableOpacity onPress={() => setModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.doctorName", "Doctor Name *")}</Text>
              <TextInput value={editing.doctor_name} onChangeText={v => setEditing(e => ({ ...e, doctor_name: v }))} placeholder={t("appointments.doctorNamePlaceholder", "Dr. Name")} placeholderTextColor={theme.textDisabled} style={inputStyle} />

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.specialty", "Specialty")}</Text>
              <TextInput value={editing.specialty} onChangeText={v => setEditing(e => ({ ...e, specialty: v }))} placeholder={t("appointments.specialtyPlaceholder", "Cardiologist, GP...")} placeholderTextColor={theme.textDisabled} style={inputStyle} />

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.phone", "Phone (for calling)")}</Text>
              <TextInput value={editing.phone} onChangeText={v => setEditing(e => ({ ...e, phone: v }))} placeholder={t("appointments.phonePlaceholder", "+91 XXXXX XXXXX")} placeholderTextColor={theme.textDisabled} style={inputStyle} keyboardType="phone-pad" />

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.date", "Date *")}</Text>
              <TouchableOpacity style={[inputStyle, { justifyContent: "space-between", flexDirection: "row", alignItems: "center" }]}
                onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: editing.date ? theme.textPrimary : theme.textDisabled, fontSize: 14 }}>
                  {editing.date ? new Date(editing.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : t("appointments.selectDate", "Select date")}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={theme.accent} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={getPickerDate()}
                  mode="date"
                  display={Platform.OS === "android" ? "calendar" : "spinner"}
                  minimumDate={new Date()}
                  onChange={(event, selected) => {
                    setShowDatePicker(false);
                    if (selected) {
                      const y = selected.getFullYear();
                      const m = String(selected.getMonth() + 1).padStart(2, "0");
                      const d = String(selected.getDate()).padStart(2, "0");
                      setEditing(e => ({ ...e, date: `${y}-${m}-${d}` }));
                    }
                  }}
                />
              )}

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.time", "Time *")}</Text>
              <TouchableOpacity style={[inputStyle, { justifyContent: "space-between", flexDirection: "row", alignItems: "center" }]}
                onPress={() => setShowTimePicker(true)}>
                <Text style={{ color: editing.time ? theme.textPrimary : theme.textDisabled, fontSize: 14 }}>
                  {editing.time || t("appointments.selectTime", "Select time")}
                </Text>
                <Ionicons name="time-outline" size={16} color={theme.accent} />
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={getPickerDate()}
                  mode="time"
                  display={Platform.OS === "android" ? "clock" : "spinner"}
                  is24Hour={false}
                  onChange={(event, selected) => {
                    setShowTimePicker(false);
                    if (selected) {
                      const h = String(selected.getHours()).padStart(2, "0");
                      const min = String(selected.getMinutes()).padStart(2, "0");
                      setEditing(e => ({ ...e, time: `${h}:${min}` }));
                    }
                  }}
                />
              )}

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.location", "Location / Clinic")}</Text>
              <TextInput value={editing.location} onChangeText={v => setEditing(e => ({ ...e, location: v }))} placeholder={t("appointments.locationPlaceholder", "Clinic name or address")} placeholderTextColor={theme.textDisabled} style={inputStyle} />

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.notes", "Notes")}</Text>
              <TextInput value={editing.notes} onChangeText={v => setEditing(e => ({ ...e, notes: v }))} placeholder={t("appointments.notesPlaceholder", "Bring reports, fasting required...")} placeholderTextColor={theme.textDisabled} style={[inputStyle, { height: 70 }]} multiline />

              <Text style={[s.label, { color: theme.textSecondary }]}>{t("appointments.reminder", "Reminder")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  ["1_day", t("appointments.oneDayBefore", "1 Day before")],
                  ["2_hours", t("appointments.twoHoursBefore", "2 Hours before")],
                  ["none", t("appointments.noReminder", "No reminder")]
                ].map(([val, lbl]) => (
                  <TouchableOpacity key={val} onPress={() => setEditing(e => ({ ...e, reminder: val }))}
                    style={[
                      s.reminderBtn,
                      { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder },
                      editing.reminder === val && { backgroundColor: theme.accentBg, borderColor: theme.accent }
                    ]}>
                    <Text style={[s.reminderTx, { color: theme.textSecondary }, editing.reminder === val && { color: theme.accent }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[s.subBtn, { backgroundColor: theme.accent }]} onPress={save} disabled={saving}>
                <Text style={s.subT}>{saving ? t("appointments.submitting", "Saving…") : editing.id ? t("appointments.updateBtn", "Update") : t("appointments.submitBtn", "Book Appointment")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setModal(false)}>
                <Text style={{ color: theme.textSecondary }}>{t("common.cancel", "Cancel")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </Modal>
      <UpgradePrompt visible={showUpgrade} onClose={() => setShowUpgrade(false)} feature="Appointment limit reached" description={`Free plan supports up to ${getFeatures().max_appointments} appointments. Upgrade to Pro Dharma for unlimited.`} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 110, gap: 12 },
  secL: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  card: { borderRadius: 14, padding: 13, gap: 8, borderWidth: 1 },
  cRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cI: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 13, fontWeight: "600" }, cS: { fontSize: 10, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 6, flexWrap: "wrap", paddingTop: 8, borderTopWidth: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 8, borderWidth: 1 },
  actionTx: { fontSize: 10, fontWeight: "600" },
  fab: { position: "absolute", right: 18, bottom: 30, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", elevation: 6 },
  ovl: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 10, zIndex: 10, elevation: 10, borderTopWidth: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 6 },
  sheetT: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5, marginBottom: -4 },
  inp: { borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1 },
  reminderBtn: { flex: 1, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reminderTx: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  subBtn: { borderRadius: 11, padding: 13, alignItems: "center", marginTop: 4 },
  subT: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
