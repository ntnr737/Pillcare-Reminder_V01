/**
 * streakEngine.ts
 * Core Streak Qualification Engine & Retention Manager for PillCare.
 * 
 * Rules:
 * 1. MANDATORY Water Intake: Logged water >= 1500 mL or >= Daily Goal.
 * 2. Medication Adherence: Scheduled doses taken. If no doses scheduled, water alone qualifies.
 * 3. Bonus Activities: Yoga, steps, measurements add Streak XP points.
 */

export const MANDATORY_WATER_THRESHOLD_ML = 1500;

export type TodayStreakStatus = {
  isWaterQualified: boolean;
  waterLoggedMl: number;
  waterTargetMl: number;
  isMedsQualified: boolean;
  totalDosesCount: number;
  takenDosesCount: number;
  isStreakSecuredToday: boolean;
  streakStatusMessage: string;
};

/**
 * Evaluates real-time streak qualification for today.
 */
export function evaluateTodayStreakStatus(
  waterLoggedMl: number,
  waterGoalMl: number = 2500,
  doses: any[] = []
): TodayStreakStatus {
  const targetWater = Math.min(MANDATORY_WATER_THRESHOLD_ML, waterGoalMl);
  const isWaterQualified = waterLoggedMl >= targetWater;

  const activeDoses = doses.filter((d) => d.status !== "cancelled");
  const totalDosesCount = activeDoses.length;
  const takenDosesCount = activeDoses.filter((d) => d.status === "taken").length;

  // If doses exist, user must take all scheduled doses (100% adherence)
  // If no doses exist for today, water qualification alone earns the daily streak!
  const isMedsQualified = totalDosesCount === 0 || (totalDosesCount > 0 && takenDosesCount >= totalDosesCount);

  const isStreakSecuredToday = isWaterQualified && isMedsQualified;

  let streakStatusMessage = "";
  if (isStreakSecuredToday) {
    streakStatusMessage = "Today's Streak Secured! Great job maintaining your health habits.";
  } else if (!isWaterQualified && !isMedsQualified) {
    const neededMl = targetWater - waterLoggedMl;
    streakStatusMessage = `Log ${neededMl} mL more water & mark doses taken to save today's streak.`;
  } else if (!isWaterQualified) {
    const neededMl = targetWater - waterLoggedMl;
    streakStatusMessage = `Log ${neededMl} mL more water to complete today's mandatory hydration streak.`;
  } else {
    streakStatusMessage = "Mark your scheduled medication dose taken to complete today's streak.";
  }

  return {
    isWaterQualified,
    waterLoggedMl,
    waterTargetMl: targetWater,
    isMedsQualified,
    totalDosesCount,
    takenDosesCount,
    isStreakSecuredToday,
    streakStatusMessage,
  };
}

export const STREAK_RULES_EXPLANATION = [
  {
    step: "1",
    icon: "water-outline",
    color: "#0284c7",
    title: "Mandatory Daily Hydration",
    desc: "Log at least 1,500 mL of water daily (or reach your daily goal). Water is mandatory every single day to maintain your active streak.",
  },
  {
    step: "2",
    icon: "medical-outline",
    color: "#4f46e5",
    title: "Medication Adherence",
    desc: "Mark your scheduled doses as taken. If you have no medications scheduled on a given day, mandatory water intake alone maintains your streak!",
  },
  {
    step: "3",
    icon: "trophy-outline",
    color: "#d97706",
    title: "Streak-Driven Leaderboard",
    desc: "Ranks on the Community Leaderboard are decided strictly by active streak days (e.g. Rank #1 = longest active streak).",
  },
  {
    step: "4",
    icon: "shield-checkmark-outline",
    color: "#059669",
    title: "Streak Protection & Bonuses",
    desc: "Logging daily yoga or health vitals earns extra Health XP and unlocks 1-day Streak Saver shields to protect your progress.",
  },
];
