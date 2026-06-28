import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { theme } from "@/src/lib/theme";

type Chip = { key: string; label: string };

export function ChipRow({
  chips,
  active,
  onSelect,
  testIDPrefix = "chip",
}: {
  chips: Chip[];
  active: string;
  onSelect: (key: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {chips.map((c) => {
          const selected = c.key === active;
          return (
            <TouchableOpacity
              key={c.key}
              testID={`${testIDPrefix}-${c.key}`}
              onPress={() => onSelect(c.key)}
              style={[styles.chip, selected ? styles.chipActive : styles.chipInactive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.label, { color: selected ? theme.colors.textInverse : theme.colors.textSecondary }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 56, justifyContent: "center" },
  row: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.colors.textPrimary },
  chipInactive: { backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  label: { fontSize: 14, fontWeight: "600" },
});
