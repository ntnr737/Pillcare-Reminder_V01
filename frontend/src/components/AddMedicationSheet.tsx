import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, Alert, Keyboard } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { PrimaryButton } from "./PrimaryButton";
import { UnitDropdownModal } from "./UnitDropdownModal";
import { TimePickerModal } from "./TimePickerModal";
import { DrugFoodGuideModal } from "./DrugFoodGuideModal";
import { UpgradePrompt } from "./UpgradePrompt";
import { getFeatures } from "@/src/lib/features";
import { api } from "@/src/lib/api";
import { get, set, K } from "@/src/lib/store";
import { enqueueWrite, flushQueue } from "@/src/lib/sync";

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
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

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
  const [foodRelation, setFoodRelation] = useState("after_food");
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTimeIdx, setShowTimeIdx] = useState<number | null>(null);
  const [foodGuideOpen, setFoodGuideOpen] = useState(false);
  const [drugFoodGuide, setDrugFoodGuide] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (visible) {
      api.units().then((r) => setUnits(r.units)).catch(() => setUnits(["tablet", "capsule", "mg", "ml"]));
      api.getDrugFoodGuide().then((g) => { if (g) setDrugFoodGuide(g); }).catch(() => {});
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
    setTimes(["08:00"]); setStartDate(new Date()); setStock("30"); setRefill("5"); setNotes(""); setFoodRelation("after_food");
  };

  const save = async () => {
    Keyboard.dismiss();
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      dosage: parseFloat(dosage) || 0,
      unit,
      food_relation: foodRelation,
      frequency_per_day: parseInt(freq) || 1,
      times,
      start_date: fmt(startDate),
      stock: parseInt(stock) || 0,
      refill_threshold: parseInt(refill) || 0,
      notes: notes.trim() || undefined,
    };
    try {
      const existing = (await get<any[]>(K.medications)) || [];
      const activeCount = existing.filter((m: any) => m && m.active !== false).length;
      const feats = getFeatures();
      const maxAllowed = feats.max_medications || 3;
      if (activeCount >= maxAllowed) {
        setShowUpgrade(true);
        return;
      }

      const localMed = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: "local",
        ...payload,
        active: true,
        created_at: new Date().toISOString(),
      };
      const updated = [localMed, ...existing];
      await set(K.medications, updated);

      await enqueueWrite("medication", payload);

      reset();
      onSaved();
      onClose();

      flushQueue().then(() => {
        api.listMedications(true).then((m) => {
          if (m && Array.isArray(m)) set(K.medications, m);
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) {
      console.warn("Save error:", e);
      Alert.alert(t("addMed.saveError", "Could not save medication"), t("addMed.saveErrorDesc", "An unexpected error occurred while saving locally."));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? "#1e2030" : "#f8fafc",
      color: theme.textPrimary,
      borderColor: theme.surfaceBorder,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t("addMed.title", "Add Medication")}</Text>
            <TouchableOpacity testID="close-add-med" onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.name", "Medication name")}</Text>
            <TextInput
              testID="med-name-input"
              value={name}
              onChangeText={setName}
              placeholder={t("addMed.namePlaceholder", "e.g. Crocin")}
              placeholderTextColor={theme.textDisabled}
              style={inputStyle}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.dosage", "Dosage")}</Text>
                <TextInput
                  testID="med-dosage-input"
                  value={dosage}
                  onChangeText={setDosage}
                  keyboardType="decimal-pad"
                  placeholder={t("addMed.dosagePlaceholder", "500 (optional)")}
                  placeholderTextColor={theme.textDisabled}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.unit", "Unit")}</Text>
                <TouchableOpacity
                  testID="unit-dropdown-btn"
                  onPress={() => setShowUnitModal(true)}
                  style={[styles.dropdownBtn, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder }]}
                >
                  <Text style={[styles.dropdownText, { color: theme.textPrimary }]}>{unit}</Text>
                  <Feather name="chevron-down" size={18} color={theme.accent} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.timesPerDay", "Times per day")}</Text>
            <TextInput
              testID="med-freq-input"
              value={freq}
              onChangeText={(t) => setFreq(t.replace(/[^0-9]/g, ""))}
              onBlur={() => setFreq((f) => (f.trim() ? String(Math.max(1, parseInt(f) || 1)) : "1"))}
              keyboardType="number-pad"
              style={inputStyle}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.scheduledTimes", "Scheduled times")}</Text>
            <View style={styles.timesWrap}>
              {times.map((t, i) => (
                <TouchableOpacity key={i} testID={`time-slot-${i}`} onPress={() => setShowTimeIdx(i)} style={[styles.timePill, { backgroundColor: theme.accentBg }]}>
                  <Text style={[styles.timeText, { color: theme.accent }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.startDate", "Start date")}</Text>
            <TouchableOpacity testID="start-date-btn" onPress={() => setShowDate(true)} style={inputStyle}>
              <Text style={[styles.inputText, { color: theme.textPrimary }]}>{fmt(startDate)}</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.stock", "Stock")}</Text>
                <TextInput testID="stock-input" value={stock} onChangeText={setStock} keyboardType="number-pad" style={inputStyle} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.refillAlert", "Refill alert at")}</Text>
                <TextInput testID="refill-input" value={refill} onChangeText={setRefill} keyboardType="number-pad" style={inputStyle} />
              </View>
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.foodInstruction", "Food Instruction (MCI Guidelines)")}</Text>
            <View style={styles.foodRow}>
              {[
                { key: "after_food", label: t("addMed.afterFood", "After Food") },
                { key: "before_food", label: t("addMed.beforeFood", "Before Food") },
                { key: "with_food", label: t("addMed.withFood", "With Food") },
                { key: "anytime", label: t("addMed.anytime", "Anytime") },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setFoodRelation(item.key)}
                  style={[
                    styles.foodChip,
                    { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder },
                    foodRelation === item.key && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                  ]}
                >
                  <Text style={[styles.foodChipText, { color: theme.textSecondary }, foodRelation === item.key && { color: theme.accent, fontWeight: "700" }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                const currentName = name.trim();
                if (currentName) {
                  api.getDrugFoodGuide(currentName).then((g) => {
                    if (g) setDrugFoodGuide(g);
                  }).catch(() => {});
                }
                setFoodGuideOpen(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
                borderWidth: 1,
                borderColor: "rgba(16,185,129,0.25)",
                marginTop: 6,
                marginBottom: 4,
              }}
            >
              <Feather name="info" size={13} color="#10B981" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#10B981" }}>
                {name.trim() ? `Check Food Interactions for "${name.trim()}"` : "View Drug-Food Interaction Guide"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("addMed.notes", "Special Notes / Instructions")}</Text>
            <TextInput
              testID="notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder={t("addMed.notesPlaceholder", "e.g. Take with a full glass of water, do not crush...")}
              placeholderTextColor={theme.textDisabled}
              style={[inputStyle, { height: 60 }]}
              multiline
            />

            <Text style={[styles.helper, { color: theme.textSecondary }]}>{t("addMed.helper", "Brand → generic name is auto-resolved by AI on save.")}</Text>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.surfaceBorder }]}>
            <PrimaryButton label={saving ? t("addMed.saving", "Saving…") : t("addMed.save", "Save Medication")} onPress={save} loading={saving} testID="save-med-btn" />
          </View>

          {showDate && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(evt, d) => {
                setShowDate(false);
                if ((Platform.OS === "ios" || evt.type === "set") && d) setStartDate(d);
              }}
            />
          )}

          <TimePickerModal
            visible={showTimeIdx !== null}
            initialTime={showTimeIdx !== null ? times[showTimeIdx] || "08:00" : "08:00"}
            onSelect={(newTimeStr) => {
              if (showTimeIdx !== null) {
                const next = [...times];
                next[showTimeIdx] = newTimeStr;
                setTimes(next);
              }
            }}
            onClose={() => setShowTimeIdx(null)}
          />

          <UnitDropdownModal
            visible={showUnitModal}
            selectedUnit={unit}
            onSelect={setUnit}
            onClose={() => setShowUnitModal(false)}
          />

          <DrugFoodGuideModal
            visible={foodGuideOpen}
            onClose={() => setFoodGuideOpen(false)}
            guide={drugFoodGuide}
            targetMedicationName={name}
          />

          <UpgradePrompt
            visible={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            feature="Medication Limit Reached"
            description={`Your Free Plan supports up to ${getFeatures().max_medications || 3} active medications. Upgrade to Caregiver Shield for unlimited medications, family alerts, and doctor reports.`}
            onSuccess={() => {
              setShowUpgrade(false);
            }}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...(StyleSheet.absoluteFill as any), backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 24, maxHeight: "92%", width: "100%", zIndex: 10, elevation: 10, borderTopWidth: 1 },
  handle: { width: 48, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  body: { paddingBottom: 16, gap: 8 },
  label: { fontSize: 14, marginTop: 8, marginBottom: 6 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, minHeight: 48 },
  inputText: { fontSize: 16 },
  row: { flexDirection: "row" },
  dropdownBtn: { borderRadius: 12, paddingHorizontal: 14, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1 },
  dropdownText: { fontSize: 15, fontWeight: "600", textTransform: "capitalize" },
  foodRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 4 },
  foodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  foodChipText: { fontSize: 12, fontWeight: "600" },
  timesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timePill: { paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  timeText: { fontWeight: "600" },
  helper: { fontSize: 12, marginTop: 12 },
  footer: { paddingTop: 12, borderTopWidth: 1 },
});
