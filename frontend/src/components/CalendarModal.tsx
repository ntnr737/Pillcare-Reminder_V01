import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";

interface CalendarModalProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

function getTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getYesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  selectedDate,
  onClose,
  onSelectDate,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [viewDate, setViewDate] = useState<Date>(new Date());
  const todayIso = getTodayIso();

  useEffect(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split("-").map(Number);
      if (y && m && d) {
        setViewDate(new Date(y, m - 1, d));
      }
    } else {
      setViewDate(new Date());
    }
  }, [selectedDate, visible]);

  if (!visible) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11

  // Calculate calendar days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const days: { day: number; iso: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const pDay = prevMonthLastDay - i;
    const pMonth = month === 0 ? 12 : month;
    const pYear = month === 0 ? year - 1 : year;
    const iso = `${pYear}-${String(pMonth).padStart(2, "0")}-${String(pDay).padStart(2, "0")}`;
    days.push({ day: pDay, iso, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, iso, isCurrentMonth: true });
  }

  // Next month padding days to complete grid
  const remaining = 42 - days.length;
  for (let n = 1; n <= remaining; n++) {
    const nMonth = month === 11 ? 1 : month + 2;
    const nYear = month === 11 ? year + 1 : year;
    const iso = `${nYear}-${String(nMonth).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    days.push({ day: n, iso, isCurrentMonth: false });
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelect = (iso: string) => {
    onSelectDate(iso);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                s.modalBox,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.surfaceBorder,
                },
              ]}
            >
              {/* Header */}
              <View style={[s.header, { borderBottomColor: theme.surfaceBorder }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="calendar-outline" size={20} color={theme.accent} />
                  <Text style={[s.headerTitle, { color: theme.textPrimary }]}>
                    {t("today.selectDate", "Select Date")}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Quick Shortcuts Pill Bar */}
              <View style={s.shortcutRow}>
                <TouchableOpacity
                  style={[
                    s.shortcutPill,
                    {
                      backgroundColor: selectedDate === todayIso ? theme.accentBg : isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                      borderColor: selectedDate === todayIso ? theme.accent : theme.surfaceBorder,
                    },
                  ]}
                  onPress={() => handleSelect(todayIso)}
                >
                  <Text
                    style={[
                      s.shortcutText,
                      { color: selectedDate === todayIso ? theme.accent : theme.textPrimary },
                    ]}
                  >
                    {t("today.today", "Today")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.shortcutPill,
                    {
                      backgroundColor: selectedDate === getYesterdayIso() ? theme.accentBg : isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                      borderColor: selectedDate === getYesterdayIso() ? theme.accent : theme.surfaceBorder,
                    },
                  ]}
                  onPress={() => handleSelect(getYesterdayIso())}
                >
                  <Text
                    style={[
                      s.shortcutText,
                      { color: selectedDate === getYesterdayIso() ? theme.accent : theme.textPrimary },
                    ]}
                  >
                    {t("today.yesterday", "Yesterday")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.shortcutPill,
                    {
                      backgroundColor: selectedDate === getTomorrowIso() ? theme.accentBg : isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                      borderColor: selectedDate === getTomorrowIso() ? theme.accent : theme.surfaceBorder,
                    },
                  ]}
                  onPress={() => handleSelect(getTomorrowIso())}
                >
                  <Text
                    style={[
                      s.shortcutText,
                      { color: selectedDate === getTomorrowIso() ? theme.accent : theme.textPrimary },
                    ]}
                  >
                    {t("today.tomorrow", "Tomorrow")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View style={s.monthNav}>
                <TouchableOpacity onPress={handlePrevMonth} style={s.navBtn}>
                  <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[s.monthTitle, { color: theme.textPrimary }]}>
                  {MONTH_NAMES[month]} {year}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={s.navBtn}>
                  <Ionicons name="chevron-forward" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Days Header */}
              <View style={s.dayHeaderRow}>
                {DAY_NAMES.map((name) => (
                  <Text key={name} style={[s.dayHeaderCell, { color: theme.textSecondary }]}>
                    {name}
                  </Text>
                ))}
              </View>

              {/* Month Grid */}
              <View style={s.grid}>
                {days.map((item, idx) => {
                  const isSelected = item.iso === selectedDate;
                  const isToday = item.iso === todayIso;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        s.dayCell,
                        isSelected && { backgroundColor: theme.accent },
                        !isSelected && isToday && {
                          borderColor: theme.accent,
                          borderWidth: 1.5,
                          backgroundColor: theme.accentBg,
                        },
                      ]}
                      onPress={() => handleSelect(item.iso)}
                    >
                      <Text
                        style={[
                          s.dayCellText,
                          {
                            color: isSelected
                              ? "#ffffff"
                              : item.isCurrentMonth
                              ? theme.textPrimary
                              : theme.textSecondary,
                            opacity: item.isCurrentMonth ? 1 : 0.35,
                            fontWeight: isSelected || isToday ? "700" : "400",
                          },
                        ]}
                      >
                        {item.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  shortcutPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: "600",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayHeaderCell: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    marginVertical: 2,
  },
  dayCellText: {
    fontSize: 13,
  },
});
