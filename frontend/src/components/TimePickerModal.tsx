import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, TextInput } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";

type Props = {
  visible: boolean;
  initialTime: string; // "HH:mm" 24h format
  onSelect: (timeStr: string) => void;
  onClose: () => void;
};

const PRESET_TIMES = [
  { label: "08:00 AM", sub: "Morning", time: "08:00" },
  { label: "12:00 PM", sub: "Noon", time: "12:00" },
  { label: "02:00 PM", sub: "Afternoon", time: "14:00" },
  { label: "06:00 PM", sub: "Evening", time: "18:00" },
  { label: "08:00 PM", sub: "Night", time: "20:00" },
  { label: "10:00 PM", sub: "Bedtime", time: "22:00" },
];

export function TimePickerModal({ visible, initialTime, onSelect, onClose }: Props) {
  const { theme, isDark } = useTheme();

  const [selectedTime, setSelectedTime] = useState(initialTime || "08:00");
  const [showNativePicker, setShowNativePicker] = useState(false);

  // Parse initial 24h string into 12h components for steppers
  const [hours24, setHours24] = useState<number>(8);
  const [minutes, setMinutes] = useState<number>(0);

  useEffect(() => {
    if (visible && initialTime) {
      const [h, m] = initialTime.split(":").map((n) => parseInt(n) || 0);
      setHours24(h);
      setMinutes(m);
      setSelectedTime(initialTime);
      setShowNativePicker(false);
    }
  }, [visible, initialTime]);

  const handleSaveTime = (timeStr: string) => {
    onSelect(timeStr);
    onClose();
  };

  const adjustHour = (delta: number) => {
    setHours24((prev) => {
      let next = (prev + delta) % 24;
      if (next < 0) next += 24;
      const fmtTimeStr = `${String(next).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      setSelectedTime(fmtTimeStr);
      return next;
    });
  };

  const adjustMinute = (delta: number) => {
    setMinutes((prev) => {
      let next = (prev + delta) % 60;
      if (next < 0) next += 60;
      const fmtTimeStr = `${String(hours24).padStart(2, "0")}:${String(next).padStart(2, "0")}`;
      setSelectedTime(fmtTimeStr);
      return next;
    });
  };

  const handleNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setShowNativePicker(false);
      if (event.type === "set" && date) {
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        handleSaveTime(`${hh}:${mm}`);
      }
    } else {
      if (date) {
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        setSelectedTime(`${hh}:${mm}`);
      }
    }
  };

  const dateObject = new Date();
  dateObject.setHours(hours24, minutes, 0, 0);

  // Format 12-hour display
  const display12H = (() => {
    const isPM = hours24 >= 12;
    const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="time-outline" size={20} color={theme.accent} />
              <Text style={[s.title, { color: theme.textPrimary }]}>Select Reminder Time</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Time Stepper Display */}
          <View style={[s.displayBox, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderColor: theme.surfaceBorder }]}>
            <View style={s.stepperCol}>
              <TouchableOpacity onPress={() => adjustHour(1)} style={s.stepBtn}>
                <Ionicons name="chevron-up" size={18} color={theme.accent} />
              </TouchableOpacity>
              <Text style={[s.timeBigText, { color: theme.textPrimary }]}>
                {String(hours24 % 12 === 0 ? 12 : hours24 % 12).padStart(2, "0")}
              </Text>
              <TouchableOpacity onPress={() => adjustHour(-1)} style={s.stepBtn}>
                <Ionicons name="chevron-down" size={18} color={theme.accent} />
              </TouchableOpacity>
            </View>

            <Text style={[s.timeBigText, { color: theme.textPrimary, marginHorizontal: 4 }]}>:</Text>

            <View style={s.stepperCol}>
              <TouchableOpacity onPress={() => adjustMinute(5)} style={s.stepBtn}>
                <Ionicons name="chevron-up" size={18} color={theme.accent} />
              </TouchableOpacity>
              <Text style={[s.timeBigText, { color: theme.textPrimary }]}>
                {String(minutes).padStart(2, "0")}
              </Text>
              <TouchableOpacity onPress={() => adjustMinute(-5)} style={s.stepBtn}>
                <Ionicons name="chevron-down" size={18} color={theme.accent} />
              </TouchableOpacity>
            </View>

            {/* AM/PM Switcher */}
            <View style={s.ampmColumn}>
              <TouchableOpacity
                onPress={() => { if (hours24 >= 12) adjustHour(-12); }}
                style={[s.ampmBtn, hours24 < 12 && { backgroundColor: theme.accent }]}>
                <Text style={[s.ampmText, { color: hours24 < 12 ? "#fff" : theme.textSecondary }]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (hours24 < 12) adjustHour(12); }}
                style={[s.ampmBtn, hours24 >= 12 && { backgroundColor: theme.accent }]}>
                <Text style={[s.ampmText, { color: hours24 >= 12 ? "#fff" : theme.textSecondary }]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Subtext 24H readout */}
          <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: "center", marginBottom: 12 }}>
            Selected 24-Hour Format: <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>{selectedTime}</Text> ({display12H})
          </Text>

          {/* Quick Preset Chips */}
          <Text style={[s.secLabel, { color: theme.textSecondary }]}>QUICK PRESETS</Text>
          <View style={s.presetGrid}>
            {PRESET_TIMES.map((p) => {
              const isSelected = selectedTime === p.time;
              return (
                <TouchableOpacity
                  key={p.time}
                  style={[
                    s.presetChip,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", borderColor: theme.surfaceBorder },
                    isSelected && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                  ]}
                  onPress={() => {
                    const [h, m] = p.time.split(":").map(Number);
                    setHours24(h);
                    setMinutes(m);
                    setSelectedTime(p.time);
                  }}>
                  <Text style={[s.presetTitle, { color: isSelected ? theme.accent : theme.textPrimary }]}>{p.label}</Text>
                  <Text style={{ fontSize: 9, color: isSelected ? theme.accent : theme.textSecondary }}>{p.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.nativeBtn, { borderColor: theme.surfaceBorder }]}
              onPress={() => setShowNativePicker(true)}>
              <Ionicons name="calendar-outline" size={15} color={theme.textPrimary} />
              <Text style={[s.nativeBtnText, { color: theme.textPrimary }]}>System Clock</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: theme.accent }]}
              onPress={() => handleSaveTime(selectedTime)}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={s.confirmBtnText}>Confirm Time</Text>
            </TouchableOpacity>
          </View>

          {/* Native Clock Fallback Trigger */}
          {showNativePicker && (
            <DateTimePicker
              value={dateObject}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleNativeChange}
            />
          )}

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  displayBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  stepperCol: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
  },
  stepBtn: {
    padding: 4,
  },
  timeBigText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
  },
  ampmColumn: {
    marginLeft: 12,
    gap: 6,
  },
  ampmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(150,150,150,0.15)",
  },
  ampmText: {
    fontSize: 11,
    fontWeight: "800",
  },
  secLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    width: "31%",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  nativeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  nativeBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  confirmBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
});
