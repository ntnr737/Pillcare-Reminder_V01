import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { theme } from "@/src/lib/theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeekStrip({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  // Build 14 days centered on today
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 7);

  const days: Date[] = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  const todayStr = fmt(today);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((d) => {
          const ds = fmt(d);
          const sel = ds === selected;
          const isToday = ds === todayStr;
          return (
            <TouchableOpacity
              key={ds}
              testID={`day-${ds}`}
              onPress={() => onSelect(ds)}
              style={[styles.day, sel && styles.daySelected]}
              activeOpacity={0.8}
            >
              <Text style={[styles.dow, sel && styles.dowSel]}>{DAYS[d.getDay()]}</Text>
              <Text style={[styles.num, sel && styles.numSel]}>{d.getDate()}</Text>
              {isToday && !sel && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 84, justifyContent: "center", backgroundColor: theme.colors.bg },
  row: { gap: 8, paddingHorizontal: 16 },
  day: {
    width: 56,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    flexShrink: 0,
  },
  daySelected: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  dow: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  num: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700", marginTop: 2 },
  dowSel: { color: theme.colors.textInverse },
  numSel: { color: theme.colors.textInverse },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.brand, marginTop: 2 },
});
