import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";

type Props = {
  visible: boolean;
  selectedUnit: string;
  onSelect: (unit: string) => void;
  onClose: () => void;
};

export const ALL_MED_UNITS = [
  { key: "tablet", label: "Tablet", desc: "Solid pill / tablet" },
  { key: "capsule", label: "Capsule", desc: "Gel / powder capsule" },
  { key: "mg", label: "mg", desc: "Milligram dosage" },
  { key: "ml", label: "ml", desc: "Liquid volume (ml)" },
  { key: "mcg", label: "mcg", desc: "Microgram dosage" },
  { key: "g", label: "g", desc: "Gram dosage" },
  { key: "drop", label: "Drops", desc: "Eye / Ear / Liquid drops" },
  { key: "puff", label: "Puff", desc: "Inhaler spray / puff" },
  { key: "patch", label: "Patch", desc: "Transdermal skin patch" },
  { key: "spray", label: "Spray", desc: "Nasal / Oral spray" },
  { key: "injection", label: "Injection", desc: "Vial / Ampoule / Syringe" },
  { key: "suppository", label: "Suppository", desc: "Rectal / Vaginal cone" },
  { key: "sachet", label: "Sachet", desc: "Powder packet" },
  { key: "iu", label: "IU", desc: "International Units" },
  { key: "tsp", label: "Teaspoon (tsp)", desc: "~5 ml liquid dose" },
  { key: "tbsp", label: "Tablespoon (tbsp)", desc: "~15 ml liquid dose" },
  { key: "ointment", label: "Ointment / Gel", desc: "Topical application" },
  { key: "cream", label: "Cream", desc: "Topical skin cream" },
];

export function UnitDropdownModal({ visible, selectedUnit, onSelect, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = ALL_MED_UNITS.filter(
    (u) =>
      u.label.toLowerCase().includes(search.toLowerCase()) ||
      u.key.toLowerCase().includes(search.toLowerCase()) ||
      u.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.content, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t("unitModal.title", "Select Medication Unit")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Field */}
          <View style={[styles.searchBox, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t("unitModal.searchPlaceholder", "Search units (e.g. tablet, ml, mg, drops)...")}
              placeholderTextColor={theme.textDisabled}
              autoCapitalize="none"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* List of Units */}
          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            <View style={styles.list}>
              {filtered.map((u) => {
                const isSelected = selectedUnit.toLowerCase() === u.key.toLowerCase();
                return (
                  <TouchableOpacity
                    key={u.key}
                    style={[
                      styles.item,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", borderColor: theme.surfaceBorder },
                      isSelected && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      onSelect(u.key);
                      onClose();
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, { color: theme.textPrimary }, isSelected && { color: theme.accent }]}>
                        {u.label}
                      </Text>
                      <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>{u.desc}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});
