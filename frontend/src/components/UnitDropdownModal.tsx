import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
        <View style={styles.content}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Select Medication Unit</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Search Field */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search units (e.g. tablet, ml, mg, drops)..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color="#64748b" />
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
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => {
                      onSelect(u.key);
                      onClose();
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                        {u.label}
                      </Text>
                      <Text style={styles.itemDesc}>{u.desc}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#38bdf8" />}
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
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  content: {
    backgroundColor: "#1e2230",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 10,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#282d3f",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#f8fafc",
    padding: 0,
  },
  list: {
    gap: 6,
    paddingVertical: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemSelected: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38bdf8",
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  itemLabelSelected: {
    color: "#38bdf8",
  },
  itemDesc: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
});
