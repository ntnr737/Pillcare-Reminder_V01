import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Calendar from "expo-calendar";
import { api } from "@/src/lib/api";
import { useFocusEffect } from "expo-router";
import { get, set } from "@/src/lib/store";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

type Appt = {
  id?: string; doctor_name: string; specialty?: string; phone?: string;
  date: string; time: string; location?: string; notes?: string; reminder?: string;
};

const BLANK: Appt = { doctor_name: "", specialty: "", phone: "", date: "", time: "", location: "", notes: "", reminder: "1_day" };

export default function Appointments() {
  const router = useRouter();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Appt>(BLANK);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (!editing.doctor_name.trim() || !editing.date || !editing.time) {
      Alert.alert("Required", "Doctor name, date and time are required."); return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await api.updateAppointment(editing.id, editing);
      } else {
        await api.createAppointment(editing);
      }
      setModal(false); setEditing(BLANK); load();
    } catch { Alert.alert("Error", "Could not save appointment."); }
    finally { setSaving(false); }
  };

  const deleteAppt = (id: string) => {
    Alert.alert("Delete", "Remove this appointment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.deleteAppointment(id); load(); } }
    ]);
  };

  const addToCalendar = async (appt: Appt) => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow calendar access to add appointments."); return; }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const cal = calendars.find(c => c.allowsModifications) || calendars[0];
      if (!cal) { Alert.alert("No calendar found"); return; }
      const [year, month, day] = appt.date.split("-").map(Number);
      const [hour, min] = appt.time.split(":").map(Number);
      const start = new Date(year, month - 1, day, hour, min);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await Calendar.createEventAsync(cal.id, {
        title: `Dr. ${appt.doctor_name} — PillCare`,
        startDate: start, endDate: end,
        location: appt.location || "",
        notes: `${appt.specialty || ""}\n${appt.notes || ""}`.trim(),
        alarms: appt.reminder !== "none" ? [{ relativeOffset: appt.reminder === "1_day" ? -1440 : -120 }] : [],
      });
      Alert.alert("Added to Calendar", `Appointment with Dr. ${appt.doctor_name} added.`);
    } catch (e) { Alert.alert("Error", "Could not add to calendar."); }
  };

  const upcoming = appts.filter(a => a.date >= new Date().toISOString().slice(0, 10));
  const past = appts.filter(a => a.date < new Date().toISOString().slice(0, 10));

  const formatDate = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const ApptCard = ({ appt }: { appt: Appt }) => (
    <View style={s.card}>
      <View style={s.cRow}>
        <View style={s.cI}><Ionicons name="medical-outline" size={17} color={A3} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cT}>Dr. {appt.doctor_name}</Text>
          {appt.specialty ? <Text style={[s.cS, { color: A3 }]}>{appt.specialty}</Text> : null}
          <Text style={s.cS}>{formatDate(appt.date)} at {appt.time}</Text>
          {appt.location ? <Text style={s.cS}>{appt.location}</Text> : null}
        </View>
      </View>
      <View style={s.cardActions}>
        {appt.phone ? (
          <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${appt.phone}`)}>
            <Ionicons name="call" size={13} color="#4ade80" />
            <Text style={[s.actionTx, { color: "#4ade80" }]}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.actionBtn} onPress={() => addToCalendar(appt)}>
          <Ionicons name="calendar" size={13} color={A3} />
          <Text style={s.actionTx}>Add to Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => { setEditing(appt); setModal(true); }}>
          <Ionicons name="pencil" size={13} color={TM} />
          <Text style={[s.actionTx, { color: TM }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => appt.id && deleteAppt(appt.id)}>
          <Ionicons name="trash" size={13} color="#e58585" />
          <Text style={[s.actionTx, { color: "#e58585" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      {appt.notes ? <Text style={[s.cS, { marginTop: 4, fontStyle: "italic" }]}>{appt.notes}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={20} color={TX} />
        </TouchableOpacity>
        <Text style={s.title}>Doctor Appointments</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}><Text style={s.cS}>Loading…</Text></View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <><Text style={s.secL}>UPCOMING</Text>{upcoming.map((a, i) => <ApptCard key={a.id || i} appt={a} />)}</>
            )}
            {past.length > 0 && (
              <><Text style={s.secL}>PAST</Text>{past.map((a, i) => <ApptCard key={a.id || i} appt={a} />)}</>
            )}
            {appts.length === 0 && (
              <View style={[s.card, { alignItems: "center", padding: 40, gap: 10 }]}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: AB, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="calendar-outline" size={26} color={AC} />
                </View>
                <Text style={s.cT}>No appointments yet</Text>
                <Text style={s.cS}>Tap + to add your first doctor appointment</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={() => { setEditing(BLANK); setModal(true); }}>
        <Ionicons name="add" size={24} color={BG} />
      </TouchableOpacity>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={s.ovl}>
          <ScrollView>
            <View style={s.sheet}>
              <View style={s.handle} />
              <Text style={s.sheetT}>{editing.id ? "Edit Appointment" : "Book Appointment"}</Text>

              <Text style={s.label}>Doctor Name *</Text>
              <TextInput value={editing.doctor_name} onChangeText={v => setEditing(e => ({ ...e, doctor_name: v }))} placeholder="Dr. Name" placeholderTextColor={TM} style={s.inp} />

              <Text style={s.label}>Specialty</Text>
              <TextInput value={editing.specialty} onChangeText={v => setEditing(e => ({ ...e, specialty: v }))} placeholder="Cardiologist, GP..." placeholderTextColor={TM} style={s.inp} />

              <Text style={s.label}>Phone (for calling)</Text>
              <TextInput value={editing.phone} onChangeText={v => setEditing(e => ({ ...e, phone: v }))} placeholder="+91 XXXXX XXXXX" placeholderTextColor={TM} style={s.inp} keyboardType="phone-pad" />

              <Text style={s.label}>Date * (YYYY-MM-DD)</Text>
              <TextInput value={editing.date} onChangeText={v => setEditing(e => ({ ...e, date: v }))} placeholder="2026-08-15" placeholderTextColor={TM} style={s.inp} keyboardType="numeric" />

              <Text style={s.label}>Time * (HH:MM)</Text>
              <TextInput value={editing.time} onChangeText={v => setEditing(e => ({ ...e, time: v }))} placeholder="10:30" placeholderTextColor={TM} style={s.inp} keyboardType="numeric" />

              <Text style={s.label}>Location / Clinic</Text>
              <TextInput value={editing.location} onChangeText={v => setEditing(e => ({ ...e, location: v }))} placeholder="Clinic name or address" placeholderTextColor={TM} style={s.inp} />

              <Text style={s.label}>Notes</Text>
              <TextInput value={editing.notes} onChangeText={v => setEditing(e => ({ ...e, notes: v }))} placeholder="Bring reports, fasting required..." placeholderTextColor={TM} style={[s.inp, { height: 70 }]} multiline />

              <Text style={s.label}>Reminder</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[["1_day", "1 Day before"], ["2_hours", "2 Hours before"], ["none", "No reminder"]].map(([val, lbl]) => (
                  <TouchableOpacity key={val} onPress={() => setEditing(e => ({ ...e, reminder: val }))}
                    style={[s.reminderBtn, editing.reminder === val && s.reminderBtnOn]}>
                    <Text style={[s.reminderTx, editing.reminder === val && { color: A3 }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.subBtn} onPress={save} disabled={saving}>
                <Text style={s.subT}>{saving ? "Saving…" : editing.id ? "Update" : "Book Appointment"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setModal(false)}>
                <Text style={{ color: TM }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BD },
  title: { fontSize: 16, fontWeight: "700", color: TX },
  body: { padding: 16, paddingBottom: 110, gap: 12 },
  secL: { fontSize: 10, letterSpacing: 1, color: TM, fontWeight: "700" },
  card: { backgroundColor: SF, borderRadius: 14, padding: 13, gap: 8, borderWidth: 1, borderColor: BD },
  cRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cI: { width: 36, height: 36, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 13, fontWeight: "600", color: TX }, cS: { fontSize: 10, color: TM, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 6, flexWrap: "wrap", paddingTop: 8, borderTopWidth: 1, borderTopColor: BD },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 8, backgroundColor: "rgba(233,233,237,0.07)", borderWidth: 1, borderColor: BD },
  actionTx: { fontSize: 10, color: A3, fontWeight: "600" },
  fab: { position: "absolute", right: 18, bottom: 30, width: 52, height: 52, borderRadius: 26, backgroundColor: AC, alignItems: "center", justifyContent: "center", elevation: 6 },
  ovl: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: N8, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 },
  sheetT: { fontSize: 16, fontWeight: "700", color: TX },
  label: { fontSize: 10, color: TM, fontWeight: "600", letterSpacing: 0.5, marginBottom: -4 },
  inp: { backgroundColor: "#1e2030", borderRadius: 10, padding: 12, color: TX, fontSize: 14, borderWidth: 1, borderColor: BD },
  reminderBtn: { flex: 1, height: 32, borderRadius: 8, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  reminderBtnOn: { backgroundColor: AB, borderColor: AC },
  reminderTx: { fontSize: 10, color: TM, fontWeight: "600", textAlign: "center" },
  subBtn: { backgroundColor: AC, borderRadius: 11, padding: 13, alignItems: "center", marginTop: 4 },
  subT: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
