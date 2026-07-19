import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/lib/theme";
import { ChipRow } from "@/src/components/ChipRow";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { AddMedicationSheet } from "@/src/components/AddMedicationSheet";
import { api } from "@/src/lib/api";
import { resyncReminders } from "@/src/lib/notifications";

const SUB_TABS = [
  { key: "medications", label: "Medications" },
  { key: "measurements", label: "Measurements" },
  { key: "activities", label: "Activities" },
  { key: "mood", label: "Mood" },
];

export default function Treatment() {
  const [active, setActive] = useState("medications");
  const [meds, setMeds] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [mood, setMood] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<{ measurements: any[]; activities: any[] } | null>(null);
  const [addMed, setAddMed] = useState(false);
  const [measureModal, setMeasureModal] = useState<{ open: boolean; type: any | null }>({ open: false, type: null });
  const [actModal, setActModal] = useState<{ open: boolean; type: any | null }>({ open: false, type: null });
  const [moodNote, setMoodNote] = useState("");
  const [moodScore, setMoodScore] = useState(3);
  const [vPrimary, setVPrimary] = useState("");
  const [vSecondary, setVSecondary] = useState("");
  const [vNote, setVNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, mes, act, mo, mc, ac] = await Promise.all([
        api.listMedications(true),
        api.listMeasurements(),
        api.listActivities(),
        api.listMood(),
        api.measurementCatalog(),
        api.activityCatalog(),
      ]);
      setMeds(m);
      setMeasurements(mes);
      setActivities(act);
      setMood(mo);
      setCatalog({ measurements: mc.measurements, activities: ac.activities });
      resyncReminders().catch(() => {});
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitMeasurement = async () => {
    if (!measureModal.type || !vPrimary) return;
    try {
      await api.createMeasurement({
        type: measureModal.type.key,
        value: parseFloat(vPrimary),
        value_secondary: vSecondary ? parseFloat(vSecondary) : undefined,
        unit: measureModal.type.unit,
        note: vNote || undefined,
      });
      setVPrimary(""); setVSecondary(""); setVNote("");
      setMeasureModal({ open: false, type: null });
      load();
    } catch (e) { console.warn(e); }
  };

  const submitActivity = async () => {
    if (!actModal.type || !vPrimary) return;
    try {
      await api.createActivity({
        type: actModal.type.key,
        value: parseFloat(vPrimary),
        unit: actModal.type.unit,
        note: vNote || undefined,
      });
      setVPrimary(""); setVNote("");
      setActModal({ open: false, type: null });
      load();
    } catch (e) { console.warn(e); }
  };

  const submitMood = async () => {
    try {
      await api.createMood({ score: moodScore, note: moodNote || undefined });
      setMoodNote("");
      load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) { console.warn(e); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Treatment</Text>
        <Text style={styles.sub}>Track everything that affects your health journey.</Text>
      </View>
      <ChipRow chips={SUB_TABS} active={active} onSelect={setActive} testIDPrefix="subtab" />

      <ScrollView contentContainerStyle={styles.body}>
        {active === "medications" && (
          <View>
            <PrimaryButton label="+ Add Medication" onPress={() => setAddMed(true)} testID="add-med-btn" />
            <View style={{ height: 16 }} />
            {meds.length === 0 && <Card><Text style={styles.empty}>No active medications yet.</Text></Card>}
            {meds.map((m) => (
              <Card key={m.id} testID={`med-${m.id}`} style={{ marginBottom: 12 }}>
                <Text style={styles.medName}>{m.name}</Text>
                {!!m.generic_name && <Text style={styles.generic}>{m.generic_name}</Text>}
                <Text style={styles.medDose}>{m.dosage} {m.unit} • {(m.times || []).join(", ")}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Stock: {m.stock}</Text>
                  <Text style={styles.metaText}>Refill at: {m.refill_threshold}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {active === "measurements" && catalog && (
          <View>
            <Text style={styles.h2}>Log a measurement</Text>
            <View style={styles.gridChips}>
              {catalog.measurements.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  testID={`measure-${m.key}`}
                  onPress={() => setMeasureModal({ open: true, type: m })}
                  style={styles.catalogChip}
                >
                  <Text style={styles.catalogLabel}>{m.label}</Text>
                  <Text style={styles.catalogUnit}>{m.unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.h2, { marginTop: 24 }]}>Recent</Text>
            {measurements.length === 0 && <Card><Text style={styles.empty}>No measurements yet.</Text></Card>}
            {measurements.slice(0, 20).map((m) => (
              <Card key={m.id} style={{ marginBottom: 8 }}>
                <View style={styles.recentRow}>
                  <View>
                    <Text style={styles.medName}>
                      {(catalog.measurements.find(x => x.key === m.type) || { label: m.type }).label}
                    </Text>
                    <Text style={styles.metaText}>{new Date(m.recorded_at).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.value}>
                    {m.value}{m.value_secondary ? `/${m.value_secondary}` : ""} {m.unit}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {active === "activities" && catalog && (
          <View>
            <Text style={styles.h2}>Log activity</Text>
            <View style={styles.gridChips}>
              {catalog.activities.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  testID={`activity-${a.key}`}
                  onPress={() => setActModal({ open: true, type: a })}
                  style={styles.catalogChip}
                >
                  <Text style={styles.catalogLabel}>{a.label}</Text>
                  <Text style={styles.catalogUnit}>{a.unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.h2, { marginTop: 24 }]}>Recent</Text>
            {activities.length === 0 && <Card><Text style={styles.empty}>No activities yet.</Text></Card>}
            {activities.slice(0, 20).map((a) => (
              <Card key={a.id} style={{ marginBottom: 8 }}>
                <View style={styles.recentRow}>
                  <View>
                    <Text style={styles.medName}>{(catalog.activities.find(x => x.key === a.type) || { label: a.type }).label}</Text>
                    <Text style={styles.metaText}>{new Date(a.recorded_at).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.value}>{a.value} {a.unit}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {active === "mood" && (
          <View>
            <Text style={styles.h2}>How do you feel right now?</Text>
            <View style={styles.moodRow}>
              {[1, 2, 3, 4, 5].map((s) => {
                const labels = ["😞", "😟", "😐", "🙂", "😄"];
                const selected = moodScore === s;
                return (
                  <TouchableOpacity key={s} testID={`mood-${s}`} onPress={() => setMoodScore(s)} style={[styles.moodPill, selected && styles.moodPillOn]}>
                    <Text style={{ fontSize: 28 }}>{labels[s - 1]}</Text>
                    <Text style={[styles.moodNum, selected && { color: theme.colors.textInverse }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              testID="mood-note"
              value={moodNote}
              onChangeText={setMoodNote}
              placeholder="What's on your mind? (optional)"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.input}
              multiline
            />
            <View style={{ height: 12 }} />
            <PrimaryButton label="Save mood" onPress={submitMood} testID="save-mood-btn" />
            <Text style={[styles.h2, { marginTop: 24 }]}>Recent</Text>
            {mood.length === 0 && <Card><Text style={styles.empty}>No mood entries yet.</Text></Card>}
            {mood.slice(0, 20).map((mo) => (
              <Card key={mo.id} style={{ marginBottom: 8 }}>
                <View style={styles.recentRow}>
                  <Text style={{ fontSize: 24 }}>{["😞","😟","😐","🙂","😄"][(mo.score - 1) || 0]}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.metaText}>{new Date(mo.recorded_at).toLocaleString()}</Text>
                    {!!mo.note && <Text style={styles.note}>{mo.note}</Text>}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <AddMedicationSheet visible={addMed} onClose={() => setAddMed(false)} onSaved={load} />

      <Modal visible={measureModal.open} transparent animationType="fade" onRequestClose={() => setMeasureModal({ open: false, type: null })}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{measureModal.type?.label}</Text>
            <Text style={styles.modalSub}>{measureModal.type?.unit}</Text>
            {measureModal.type?.composite ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={vPrimary} onChangeText={setVPrimary} placeholder="Systolic" placeholderTextColor={theme.colors.textDisabled} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} testID="measure-primary" />
                <TextInput value={vSecondary} onChangeText={setVSecondary} placeholder="Diastolic" placeholderTextColor={theme.colors.textDisabled} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} testID="measure-secondary" />
              </View>
            ) : (
              <TextInput value={vPrimary} onChangeText={setVPrimary} placeholder="Value" placeholderTextColor={theme.colors.textDisabled} keyboardType="decimal-pad" style={styles.input} testID="measure-primary" />
            )}
            <TextInput value={vNote} onChangeText={setVNote} placeholder="Note (optional)" placeholderTextColor={theme.colors.textDisabled} style={styles.input} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <PrimaryButton label="Cancel" variant="ghost" onPress={() => setMeasureModal({ open: false, type: null })} style={{ flex: 1 }} />
              <PrimaryButton label="Save" onPress={submitMeasurement} testID="save-measure-btn" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={actModal.open} transparent animationType="fade" onRequestClose={() => setActModal({ open: false, type: null })}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{actModal.type?.label}</Text>
            <Text style={styles.modalSub}>{actModal.type?.unit}</Text>
            <TextInput value={vPrimary} onChangeText={setVPrimary} placeholder="Value" placeholderTextColor={theme.colors.textDisabled} keyboardType="decimal-pad" style={styles.input} testID="activity-value" />
            <TextInput value={vNote} onChangeText={setVNote} placeholder="Note (optional)" placeholderTextColor={theme.colors.textDisabled} style={styles.input} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <PrimaryButton label="Cancel" variant="ghost" onPress={() => setActModal({ open: false, type: null })} style={{ flex: 1 }} />
              <PrimaryButton label="Save" onPress={submitActivity} testID="save-activity-btn" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  sub: { color: theme.colors.textSecondary, marginTop: 4 },
  body: { padding: 16, paddingBottom: 120 },
  h2: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  empty: { color: theme.colors.textSecondary, padding: 8 },
  medName: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  generic: { color: theme.colors.textSecondary, marginTop: 2, fontSize: 12 },
  medDose: { color: theme.colors.brand, marginTop: 6, fontWeight: "600" },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  metaText: { color: theme.colors.textSecondary, fontSize: 12 },
  value: { color: theme.colors.brand, fontSize: 18, fontWeight: "700" },
  recentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gridChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catalogChip: { backgroundColor: theme.colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, minWidth: 130 },
  catalogLabel: { color: theme.colors.textPrimary, fontWeight: "600", fontSize: 14 },
  catalogUnit: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, gap: 8 },
  moodPill: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  moodPillOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  moodNum: { color: theme.colors.textSecondary, fontWeight: "700", marginTop: 4 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, padding: 14, color: theme.colors.textPrimary, marginTop: 8, minHeight: 48 },
  note: { color: theme.colors.textPrimary, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: theme.colors.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  modalSub: { color: theme.colors.textSecondary, marginTop: 4, marginBottom: 12 },
});
