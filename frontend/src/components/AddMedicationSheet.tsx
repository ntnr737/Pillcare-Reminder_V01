import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { theme } from "@/src/lib/theme";
import { PrimaryButton } from "./PrimaryButton";
import { api } from "@/src/lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AddMedicationSheet({ visible, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("tablet");
  const [units, setUnits] = useState<string[]>([]);
  const [freq, setFreq] = useState("1");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [stock, setStock] = useState("30");
  const [refill, setRefill] = useState("5");
  const [notes, setNotes] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [showTimeIdx, setShowTimeIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      api.units().then((r) => setUnits(r.units)).catch(() => setUnits(["tablet", "capsule", "mg", "ml"]));
    }
  }, [visible]);

  useEffect(() => {
    const n = Math.max(1, parseInt(freq) || 1);
    setTimes((prev) => {
      if (prev.length === n) return prev;
      if (n < prev.length) return prev.slice(0, n);
      const defaults = ["08:00", "14:00", "20:00", "22:00", "06:00", "12:00"];
      const add = defaults.slice(prev.length, n);
      return [...prev, ...add];
    });
  }, [freq]);

  const reset = () => {
    setName(""); setDosage(""); setUnit("tablet"); setFreq("1");
    setTimes(["08:00"]); setStartDate(new Date()); setStock("30"); setRefill("5"); setNotes("");
  };

  const save = async () => {
    if (!name.trim() || !dosage.trim()) return;
    setSaving(true);
    try {
      await api.createMedication({
        name: name.trim(),
        dosage: parseFloat(dosage) || 0,
        unit,
        frequency_per_day: parseInt(freq) || 1,
        times,
        start_date: fmt(startDate),
        stock: parseInt(stock) || 0,
        refill_threshold: parseInt(refill) || 0,
        notes: notes.trim() || undefined,
      });
      reset();
      onSaved();
      onClose();
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Add Medication</Text>
            <TouchableOpacity testID="close-add-med" onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Medication name</Text>
            <TextInput
              testID="med-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Crocin"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.input}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Dosage</Text>
                <TextInput
                  testID="med-dosage-input"
                  value={dosage}
                  onChangeText={setDosage}
                  keyboardType="decimal-pad"
                  placeholder="500"
                  placeholderTextColor={theme.colors.textDisabled}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {units.map((u) => (
                    <TouchableOpacity
                      key={u}
                      testID={`unit-${u}`}
                      onPress={() => setUnit(u)}
                      style={[styles.chip, unit === u && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={styles.label}>Times per day</Text>
            <TextInput
              testID="med-freq-input"
              value={freq}
              onChangeText={(t) => setFreq(t.replace(/[^0-9]/g, "") || "1")}
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Scheduled times</Text>
            <View style={styles.timesWrap}>
              {times.map((t, i) => (
                <TouchableOpacity key={i} testID={`time-slot-${i}`} onPress={() => setShowTimeIdx(i)} style={styles.timePill}>
                  <Text style={styles.timeText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Start date</Text>
            <TouchableOpacity testID="start-date-btn" onPress={() => setShowDate(true)} style={styles.input}>
              <Text style={styles.inputText}>{fmt(startDate)}</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Stock</Text>
                <TextInput testID="stock-input" value={stock} onChangeText={setStock} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Refill alert at</Text>
                <TextInput testID="refill-input" value={refill} onChangeText={setRefill} keyboardType="number-pad" style={styles.input} />
              </View>
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              testID="notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="After food"
              placeholderTextColor={theme.colors.textDisabled}
              style={[styles.input, { height: 60 }]}
              multiline
            />

            <Text style={styles.helper}>Brand → generic name is auto-resolved by AI on save.</Text>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label={saving ? "Saving…" : "Save Medication"} onPress={save} loading={saving} testID="save-med-btn" />
          </View>

          {showDate && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, d) => { setShowDate(false); if (d) setStartDate(d); }}
            />
          )}
          {showTimeIdx !== null && (
            <DateTimePicker
              value={(() => {
                const [hh, mm] = times[showTimeIdx].split(":").map(Number);
                const d = new Date(); d.setHours(hh); d.setMinutes(mm); return d;
              })()}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, d) => {
                if (showTimeIdx === null) return;
                const idx = showTimeIdx;
                setShowTimeIdx(null);
                if (d) {
                  const next = [...times];
                  next[idx] = fmtTime(d);
                  setTimes(next);
                }
              }}
            />
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 24, maxHeight: "92%" },
  handle: { width: 48, height: 4, backgroundColor: theme.colors.borderStrong, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 },
  title: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  close: { color: theme.colors.brand, fontSize: 14, fontWeight: "600" },
  body: { paddingBottom: 16, gap: 8 },
  label: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 14, color: theme.colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle, minHeight: 48 },
  inputText: { color: theme.colors.textPrimary, fontSize: 16 },
  row: { flexDirection: "row" },
  chip: { backgroundColor: theme.colors.surfaceElevated, height: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.borderSubtle, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { color: theme.colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: theme.colors.textInverse },
  timesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timePill: { paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandMuted, alignItems: "center", justifyContent: "center" },
  timeText: { color: theme.colors.brand, fontWeight: "600" },
  helper: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 12 },
  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
});
