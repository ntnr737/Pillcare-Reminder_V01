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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { api } from "@/src/lib/api";
import { get, set, K } from "@/src/lib/store";
import { getStoredUser } from "@/src/lib/auth";
import { STREAK_RULES_EXPLANATION } from "@/src/lib/streakEngine";

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
  streakDays = 0,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"leaderboard" | "calendar">(initialTab);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [claimedBonus, setClaimedBonus] = useState(false);
  const [bonusXP, setBonusXP] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userName, setUserName] = useState<string>("You");
  const todayIso = getTodayIso();

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      Promise.all([
        getStoredUser().catch(() => null),
        get<any>(K.profile).catch(() => null),
      ]).then(([u, p]) => {
        const raw = (p?.nickname && p.nickname.toUpperCase() !== "YOU" ? p.nickname : "") || p?.name || u?.name;
        if (raw && raw.trim().length > 0) {
          const parts = raw.trim().split(/\s+/);
          setUserName(parts[0]);
        }
      });

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
      Alert.alert("Already Claimed", "You have already claimed today's Daily Streak Bonus! Come back tomorrow.");
      return;
    }
    setClaimedBonus(true);
    await set(`daily_bonus_${todayIso}`, true);
    Alert.alert("Daily Streak Saver Unlocked!", "Daily Streak Bonus unlocked! Keep logging mandatory water and doses to climb the PillCare Champions Leaderboard.");
  };

  const effectiveStreak = (typeof leaderboardData?.current_streak === "number")
    ? leaderboardData.current_streak
    : (typeof streakDays === "number" ? streakDays : 0);

  const fallbackChampionsRaw = [
    { nickname: `${userName} (You)`, streak: effectiveStreak, points: effectiveStreak * 100 + 250, adherence: (leaderboardData?.adherence_rate ?? 98.5), badge: "Active", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", is_user: true },
    { nickname: "Dr. Priya Sharma", streak: 28, points: 3050, adherence: 99.2, badge: "Grand Master", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Rajesh Kumar", streak: 24, points: 2680, adherence: 97.5, badge: "Legend", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Anita Verma", streak: 21, points: 2340, adherence: 96.0, badge: "Legend", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Amit Patel", streak: 18, points: 2010, adherence: 94.8, badge: "Master", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Sunita Rao", streak: 15, points: 1720, adherence: 93.1, badge: "Warrior", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Vikram Singh", streak: 12, points: 1450, adherence: 91.5, badge: "Warrior", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Meera Joshi", streak: 10, points: 1240, adherence: 89.8, badge: "Guardian", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Karan Malhotra", streak: 8, points: 1020, adherence: 88.0, badge: "Guardian", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", is_user: false },
    { nickname: "Sanjay Gupta", streak: 6, points: 850, adherence: 86.5, badge: "Starter", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80", is_user: false },
  ];

  const baseChampions = (leaderboardData?.champions && Array.isArray(leaderboardData.champions))
    ? leaderboardData.champions.map((c: any) => c.is_user ? { ...c, streak: effectiveStreak } : c)
    : fallbackChampionsRaw;

  const champions = [...baseChampions]
    .sort((a: any, b: any) => (b.streak - a.streak) || ((b.points || 0) - (a.points || 0)))
    .map((c: any, idx: number) => ({ ...c, rank: idx + 1 }));

  const userEntry = champions.find((c: any) => c.is_user);
  const userRank = userEntry ? userEntry.rank : (leaderboardData?.user_rank || champions.length);

  const defaultRankTier = effectiveStreak >= 30
    ? "Grand Master Champion"
    : effectiveStreak >= 14
    ? "Adherence Legend"
    : effectiveStreak >= 7
    ? "Streak Warrior"
    : "Health Starter";

  const rankTier = leaderboardData?.rank_tier || defaultRankTier;

  const handleShareStreak = () => {
    const currentStrk = effectiveStreak;
    const rank = `#${userRank}`;
    const msg = encodeURIComponent(`I am on a ${currentStrk}-day Health Streak on PillCare (Rank ${rank} Champion)! Join me in maintaining daily hydration & health habits!`);
    Linking.openURL(`https://wa.me/?text=${msg}`);
  };

  const badges = leaderboardData?.badges || [
    { id: "b1", title: "7-Day Warrior", desc: "Maintain 7 consecutive days of hydration & adherence", icon: "flash", unlocked: effectiveStreak >= 7 },
    { id: "b2", title: "14-Day Champion", desc: "Complete 14 days without breaking streak", icon: "trophy", unlocked: effectiveStreak >= 14 },
    { id: "b3", title: "30-Day Master Legend", desc: "Reach 1 month perfect health streak", icon: "ribbon", unlocked: effectiveStreak >= 30 },
    { id: "b4", title: "Yoga & Mind Guru", desc: "Log 5 clinical yoga sessions in a week", icon: "body", unlocked: true },
    { id: "b5", title: "Hydration Hero", desc: "Achieve mandatory daily water goal 3 days in a row", icon: "water", unlocked: true },
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
                  <Ionicons name="flame-outline" size={14} color={activeTab === "leaderboard" ? "#fff" : theme.textSecondary} />
                  <Text style={[s.tabText, { color: activeTab === "leaderboard" ? "#fff" : theme.textSecondary }]}>
                    Streak Ranks
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
                  
                  {/* Active Competition Banner */}
                  {leaderboardData?.active_competition && (
                    <View style={[s.competitionBanner, { backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", borderColor: "#F59E0B" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="trophy" size={16} color="#D97706" />
                          <Text style={{ fontSize: 11, fontWeight: "900", color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Active Health Competition
                          </Text>
                        </View>
                        <View style={{ backgroundColor: "#F59E0B", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                            {leaderboardData.active_competition.target_streak}-DAY SPRINT
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 14, fontWeight: "800", color: theme.textPrimary, marginTop: 4 }}>
                        {leaderboardData.active_competition.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15, marginTop: 2 }}>
                        {leaderboardData.active_competition.description}
                      </Text>

                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="gift" size={13} color="#D97706" />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>
                            {leaderboardData.active_competition.prize_pool}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600" }}>
                          Badge: {leaderboardData.active_competition.badge_reward}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Hero Rank Card */}
                  <View style={[s.heroCard, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)", borderColor: "#F59E0B" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#F59E0B", letterSpacing: 0.8 }}>
                          YOUR STREAK RANK & TIER
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.textPrimary }}>
                          {rankTier}
                        </Text>
                      </View>
                      <View style={s.rankBadge}>
                        <Text style={s.rankBadgeText}>{`#${userRank}`}</Text>
                      </View>
                    </View>

                    <View style={[s.statGrid, { justifyContent: "space-around" }]}>
                      <View style={s.statBox}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="flame" size={16} color="#F59E0B" />
                          <Text style={s.statVal}>{effectiveStreak} {effectiveStreak === 1 ? "Day" : "Days"}</Text>
                        </View>
                        <Text style={s.statLbl}>Active Streak</Text>
                      </View>
                      <View style={s.statBox}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="trending-up" size={16} color="#F59E0B" />
                          <Text style={s.statVal}>{leaderboardData?.adherence_rate ?? 98.5}%</Text>
                        </View>
                        <Text style={s.statLbl}>Consistency Rate</Text>
                      </View>
                    </View>
                  </View>

                  {/* Daily Streak Saver Claim Button */}
                  <TouchableOpacity
                    style={[s.claimBtn, { backgroundColor: claimedBonus ? "rgba(74,222,128,0.15)" : "#F59E0B", borderColor: claimedBonus ? "#4ade80" : "#F59E0B" }]}
                    onPress={handleClaimBonus}>
                    <Ionicons name={claimedBonus ? "checkmark-circle" : "shield-checkmark"} size={18} color={claimedBonus ? "#4ade80" : "#fff"} />
                    <Text style={[s.claimBtnText, { color: claimedBonus ? "#4ade80" : "#fff" }]}>
                      {claimedBonus ? "Daily Streak Saver Activated" : "Activate Daily Streak Saver Shield"}
                    </Text>
                  </TouchableOpacity>

                  {/* How Streak Works Card */}
                  <View style={{ backgroundColor: theme.surface, borderColor: theme.surfaceBorder, padding: 12, gap: 8, borderRadius: 14, borderWidth: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="information-circle" size={18} color={theme.accent} />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: theme.textPrimary }}>How Streak Works</Text>
                    </View>

                    <View style={{ gap: 8, marginTop: 4 }}>
                      {STREAK_RULES_EXPLANATION.map((rule) => (
                        <View key={rule.step} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: rule.color, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name={rule.icon as any} size={12} color="#fff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textPrimary }}>{rule.title}</Text>
                            <Text style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 14 }}>{rule.desc}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Community Champions Leaderboard */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[s.secTitle, { color: theme.textSecondary }]}>COMMUNITY TOP 10 CHAMPIONS</Text>
                      <TouchableOpacity onPress={handleShareStreak}>
                        <Text style={{ fontSize: 12, color: theme.accent, fontWeight: "700" }}>Challenge Friends →</Text>
                      </TouchableOpacity>
                    </View>

                    {champions.map((c: any) => {
                      const avatarUri = c.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
                      const initials = (c.nickname || "U")
                        .replace(/^(Dr\.|Mr\.|Mrs\.)\s*/, "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase();

                      return (
                        <View
                          key={c.is_user ? "current_user_champ" : (c.nickname || String(c.rank))}
                          style={[
                            s.championRow,
                            { backgroundColor: theme.surface, borderColor: c.is_user ? "#F59E0B" : theme.surfaceBorder },
                            c.is_user && { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.06)", borderWidth: 1.5 }
                          ]}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Text style={[s.championRank, { color: c.rank === 1 ? "#F59E0B" : c.rank === 2 ? "#94A3B8" : c.rank === 3 ? "#D97706" : theme.textSecondary }]}>
                              #{c.rank}
                            </Text>
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.is_user ? "#F59E0B" : theme.surfaceBorder }}>
                              <Image
                                source={{ uri: avatarUri }}
                                style={{ width: 34, height: 34, borderRadius: 17 }}
                                resizeMode="cover"
                              />
                            </View>
                            <View>
                              <Text style={[s.championName, { color: theme.textPrimary }, c.is_user && { fontWeight: "800", color: "#F59E0B" }]}>
                                {c.nickname}
                              </Text>
                              <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                                {c.adherence}% adherence • {c.streak} {c.streak === 1 ? "day" : "days"} streak
                              </Text>
                            </View>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="flame" size={14} color="#F59E0B" />
                              <Text style={{ fontSize: 13, fontWeight: "800", color: "#F59E0B" }}>{c.streak} {c.streak === 1 ? "Day" : "Days"}</Text>
                            </View>
                            <Text style={{ fontSize: 10, color: theme.textSecondary }}>{c.badge}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Health Badges & Trophies */}
                  <View style={{ gap: 8 }}>
                    <Text style={[s.secTitle, { color: theme.textSecondary }]}>STREAK BADGES & TROPHIES</Text>
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
                              {b.unlocked ? "Unlocked" : "Locked"}
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
  competitionBanner: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
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
