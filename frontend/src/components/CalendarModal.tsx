import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { api } from "@/src/lib/api";
import { get, set } from "@/src/lib/store";

interface CalendarModalProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (date: string) => void;
  initialTab?: "leaderboard" | "calendar";
  streakDays?: number;
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
  initialTab = "leaderboard",
  streakDays = 14,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"leaderboard" | "calendar">(initialTab);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [claimedBonus, setClaimedBonus] = useState(false);
  const [bonusXP, setBonusXP] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const todayIso = getTodayIso();

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      // Fetch dynamic community leaderboard data from backend
      api.getLeaderboard().then(data => {
        if (data) setLeaderboardData(data);
      }).catch(() => {});
      // Check if daily bonus was already claimed today
      get<boolean>(`daily_bonus_${todayIso}`).then(claimed => {
        if (claimed) setClaimedBonus(true);
      });
    }
  }, [visible, initialTab]);

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

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const pDay = prevMonthLastDay - i;
    const pMonth = month === 0 ? 12 : month;
    const pYear = month === 0 ? year - 1 : year;
    const iso = `${pYear}-${String(pMonth).padStart(2, "0")}-${String(pDay).padStart(2, "0")}`;
    days.push({ day: pDay, iso, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, iso, isCurrentMonth: true });
  }

  const remaining = 42 - days.length;
  for (let n = 1; n <= remaining; n++) {
    const nMonth = month === 11 ? 1 : month + 2;
    const nYear = month === 11 ? year + 1 : year;
    const iso = `${nYear}-${String(nMonth).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    days.push({ day: n, iso, isCurrentMonth: false });
  }

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleSelect = (iso: string) => {
    onSelectDate(iso);
    onClose();
  };

  const handleClaimBonus = async () => {
    if (claimedBonus) {
      Alert.alert("Already Claimed", "You have already claimed today's +50 XP Streak Bonus! Come back tomorrow.");
      return;
    }
    setClaimedBonus(true);
    setBonusXP(prev => prev + 50);
    await set(`daily_bonus_${todayIso}`, true);
    Alert.alert("🔥 +50 XP Bonus Claimed!", "Daily Streak Bonus unlocked! Keep taking your doses on time and practicing daily yoga to climb the PillCare Champions Leaderboard.");
  };

  const handleShareStreak = () => {
    const currentStrk = leaderboardData?.current_streak || streakDays || 14;
    const rank = leaderboardData?.user_rank ? `#${leaderboardData.user_rank}` : "#1";
    const msg = encodeURIComponent(`🔥 I am on a ${currentStrk}-day Health Streak on PillCare (Rank ${rank} Champion)! Join me in staying 100% adherent to daily medications & wellness routines!`);
    Linking.openURL(`https://wa.me/?text=${msg}`);
  };

  const champions = leaderboardData?.champions || [
    { rank: 1, nickname: "Nitin K. (You)", streak: Math.max(14, streakDays), points: 2450 + bonusXP, adherence: 98.5, badge: "👑 Champion", is_user: true },
    { rank: 2, nickname: "Priya S.", streak: 21, points: 2180, adherence: 96.2, badge: "🌟 Legend", is_user: false },
    { rank: 3, nickname: "Dr. Rajesh M.", streak: 18, points: 1920, adherence: 95.0, badge: "🔥 Master", is_user: false },
    { rank: 4, nickname: "Anita V.", streak: 14, points: 1650, adherence: 93.8, badge: "⚡ Warrior", is_user: false },
    { rank: 5, nickname: "Amit P.", streak: 12, points: 1420, adherence: 91.5, badge: "⚡ Warrior", is_user: false },
  ];

  const badges = leaderboardData?.badges || [
    { id: "b1", title: "7-Day Warrior", desc: "Maintain 7 consecutive days of adherence", icon: "flash", unlocked: streakDays >= 7, pts: 100 },
    { id: "b2", title: "14-Day Champion", desc: "Complete 14 days without missing a dose", icon: "trophy", unlocked: streakDays >= 14, pts: 250 },
    { id: "b3", title: "30-Day Master Legend", desc: "Reach 1 month perfect health streak", icon: "ribbon", unlocked: streakDays >= 30, pts: 500 },
    { id: "b4", title: "Yoga & Mind Guru", desc: "Log 5 clinical yoga sessions in a week", icon: "body", unlocked: true, pts: 150 },
    { id: "b5", title: "Hydration Hero", desc: "Achieve daily water goal 3 days in a row", icon: "water", unlocked: true, pts: 100 },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              
              {/* Top Header */}
              <View style={[s.header, { borderBottomColor: theme.surfaceBorder }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name={activeTab === "leaderboard" ? "trophy" : "calendar"} size={20} color="#F59E0B" />
                  <Text style={[s.headerTitle, { color: theme.textPrimary }]}>
                    {activeTab === "leaderboard" ? "Health Streak Leaderboard" : "Calendar & Dose History"}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Segmented Tab Switcher */}
              <View style={[s.tabBar, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }]}>
                <TouchableOpacity
                  style={[s.tabBtn, activeTab === "leaderboard" && { backgroundColor: theme.accent }]}
                  onPress={() => setActiveTab("leaderboard")}>
                  <Ionicons name="trophy-outline" size={14} color={activeTab === "leaderboard" ? "#fff" : theme.textSecondary} />
                  <Text style={[s.tabText, { color: activeTab === "leaderboard" ? "#fff" : theme.textSecondary }]}>
                    Leaderboard & Ranks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tabBtn, activeTab === "calendar" && { backgroundColor: theme.accent }]}
                  onPress={() => setActiveTab("calendar")}>
                  <Ionicons name="calendar-outline" size={14} color={activeTab === "calendar" ? "#fff" : theme.textSecondary} />
                  <Text style={[s.tabText, { color: activeTab === "calendar" ? "#fff" : theme.textSecondary }]}>
                    Calendar Grid
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === "leaderboard" ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
                  
                  {/* Hero Rank Card */}
                  <View style={[s.heroCard, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)", borderColor: "#F59E0B" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#F59E0B", letterSpacing: 0.8 }}>
                          YOUR RANK & TIER
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.textPrimary }}>
                          {leaderboardData?.rank_tier || "Adherence Champion 👑"}
                        </Text>
                      </View>
                      <View style={s.rankBadge}>
                        <Text style={s.rankBadgeText}>{leaderboardData?.user_rank ? `#${leaderboardData.user_rank}` : "#1"}</Text>
                      </View>
                    </View>

                    <View style={s.statGrid}>
                      <View style={s.statBox}>
                        <Text style={s.statVal}>🔥 {streakDays}d</Text>
                        <Text style={s.statLbl}>Streak Days</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={s.statVal}>⚡ {leaderboardData?.adherence_rate || 98.5}%</Text>
                        <Text style={s.statLbl}>Adherence Rate</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={s.statVal}>⭐ {2450 + bonusXP}</Text>
                        <Text style={s.statLbl}>Health XP</Text>
                      </View>
                    </View>
                  </View>

                  {/* Daily Bonus Claim Button */}
                  <TouchableOpacity
                    style={[s.claimBtn, { backgroundColor: claimedBonus ? "rgba(74,222,128,0.15)" : "#F59E0B", borderColor: claimedBonus ? "#4ade80" : "#F59E0B" }]}
                    onPress={handleClaimBonus}>
                    <Ionicons name={claimedBonus ? "checkmark-circle" : "gift"} size={18} color={claimedBonus ? "#4ade80" : "#fff"} />
                    <Text style={[s.claimBtnText, { color: claimedBonus ? "#4ade80" : "#fff" }]}>
                      {claimedBonus ? "Daily Streak Bonus Claimed (+50 XP)" : "Claim Daily Streak Bonus (+50 XP)"}
                    </Text>
                  </TouchableOpacity>

                  {/* Community Champions Leaderboard */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[s.secTitle, { color: theme.textSecondary }]}>COMMUNITY TOP CHAMPIONS</Text>
                      <TouchableOpacity onPress={handleShareStreak}>
                        <Text style={{ fontSize: 12, color: theme.accent, fontWeight: "700" }}>Challenge Friends →</Text>
                      </TouchableOpacity>
                    </View>

                    {champions.map((c: any) => (
                      <View
                        key={c.rank}
                        style={[
                          s.championRow,
                          { backgroundColor: theme.surface, borderColor: c.is_user ? "#F59E0B" : theme.surfaceBorder },
                          c.is_user && { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.06)", borderWidth: 1.5 }
                        ]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={[s.championRank, { color: c.rank === 1 ? "#F59E0B" : c.rank === 2 ? "#94A3B8" : c.rank === 3 ? "#D97706" : theme.textSecondary }]}>
                            #{c.rank}
                          </Text>
                          <View>
                            <Text style={[s.championName, { color: theme.textPrimary }, c.is_user && { fontWeight: "800", color: "#F59E0B" }]}>
                              {c.nickname}
                            </Text>
                            <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                              {c.adherence}% adherence • {c.streak} day streak
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#F59E0B" }}>{c.points} XP</Text>
                          <Text style={{ fontSize: 10, color: theme.textSecondary }}>{c.badge}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Health Badges & Trophies */}
                  <View style={{ gap: 8 }}>
                    <Text style={[s.secTitle, { color: theme.textSecondary }]}>HEALTH BADGES & TROPHIES</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {badges.map((b: any) => (
                        <View key={b.id} style={[s.badgeCard, { backgroundColor: theme.surface, borderColor: b.unlocked ? "#F59E0B" : theme.surfaceBorder }]}>
                          <View style={[s.badgeIconBox, { backgroundColor: b.unlocked ? "rgba(245,158,11,0.18)" : isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }]}>
                            <Ionicons name={b.icon as any} size={20} color={b.unlocked ? "#F59E0B" : theme.textDisabled} />
                          </View>
                          <Text style={[s.badgeTitle, { color: b.unlocked ? theme.textPrimary : theme.textSecondary }]}>{b.title}</Text>
                          <Text style={{ fontSize: 9, color: theme.textSecondary, textAlign: "center" }} numberOfLines={2}>{b.desc}</Text>
                          <View style={[s.badgeStatusPill, { backgroundColor: b.unlocked ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)" }]}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: b.unlocked ? "#4ade80" : theme.textSecondary }}>
                              {b.unlocked ? `Unlocked (+${b.pts} XP)` : "Locked"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                </ScrollView>
              ) : (
                <View style={{ gap: 12 }}>
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
                      onPress={() => handleSelect(todayIso)}>
                      <Text style={[s.shortcutText, { color: selectedDate === todayIso ? theme.accent : theme.textPrimary }]}>
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
                      onPress={() => handleSelect(getYesterdayIso())}>
                      <Text style={[s.shortcutText, { color: selectedDate === getYesterdayIso() ? theme.accent : theme.textPrimary }]}>
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
                      onPress={() => handleSelect(getTomorrowIso())}>
                      <Text style={[s.shortcutText, { color: selectedDate === getTomorrowIso() ? theme.accent : theme.textPrimary }]}>
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
                          onPress={() => handleSelect(item.iso)}>
                          <Text
                            style={[
                              s.dayCellText,
                              {
                                color: isSelected ? "#ffffff" : item.isCurrentMonth ? theme.textPrimary : theme.textSecondary,
                                opacity: item.isCurrentMonth ? 1 : 0.35,
                                fontWeight: isSelected || isToday ? "700" : "400",
                              },
                            ]}>
                            {item.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

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
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 12,
    elevation: 12,
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
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    borderRadius: 9,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  rankBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rankBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  statGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(245,158,11,0.2)",
  },
  statBox: {
    alignItems: "center",
  },
  statVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F59E0B",
  },
  statLbl: {
    fontSize: 10,
    color: "rgba(245,158,11,0.85)",
    fontWeight: "600",
    marginTop: 2,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  claimBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  secTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  championRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  championRank: {
    fontSize: 13,
    fontWeight: "800",
    width: 24,
  },
  championName: {
    fontSize: 13,
    fontWeight: "600",
  },
  badgeCard: {
    width: 120,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  badgeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  badgeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
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
