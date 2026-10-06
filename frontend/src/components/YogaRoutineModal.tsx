import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  TextStyle,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { get, set, K } from "@/src/lib/store";
import { track } from "@/src/lib/analytics";

export interface YogaStep {
  num: number;
  name: string;
  duration: string;
  benefit?: string;
  channel?: string;
  youtube_video?: string;
  youtube_channel?: string;
}

export interface YogaRoutineModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenVideo: (video: { url: string; title: string; channel?: string; benefit?: string; step?: any }) => void;
  customTitle?: string;
  customDuration?: string;
  customLevel?: string;
}

export const DEFAULT_YOGA_ROUTINE = {
  title: "Thyroid & Digestive Balance Yoga",
  duration: "15 min",
  level: "Beginner",
  description: "This sequence gently stimulates the thyroid gland, improves metabolism, and supports overall vitality while complementing the patient's medication regimen. The routine is short, beginner-friendly, and aligns with guidelines from AYUSH, Patanjali, and Isha.",
  steps: [
    { num: 1, name: "Surya Namaskar (Sun Salutation)", duration: "3 min", benefit: "Activates metabolism and improves circulation, supporting thyroid function.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=sTANio_2E0Q" },
    { num: 2, name: "Sarvangasana (Shoulder Stand)", duration: "3 min", benefit: "Increases blood flow to the neck area, stimulating the thyroid gland.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=hJbRpHZr_d0" },
    { num: 3, name: "Matsyasana (Fish Pose)", duration: "3 min", benefit: "Stretches the neck and throat region, relieving neck tension.", channel: "Swami Ramdev", youtube_video: "https://www.youtube.com/watch?v=sTANio_2E0Q" },
    { num: 4, name: "Bhujangasana (Cobra Pose)", duration: "3 min", benefit: "Opens the chest and throat, boosting energy and flexibility.", channel: "Sadhguru", youtube_video: "https://www.youtube.com/watch?v=hJbRpHZr_d0" },
    { num: 5, name: "Ustrasana (Camel Pose)", duration: "3 min", benefit: "Enhances respiratory and endocrine health through gentle back extension.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=sTANio_2E0Q" }
  ],
  channels: [
    { name: "Ministry of AYUSH, Govt. of India", url: "https://www.youtube.com/@ministryofayushofficial", verified: true },
    { name: "Swami Ramdev — Patanjali Yogpeeth", url: "https://www.youtube.com/@SwamiRamdevOfficial", verified: true },
    { name: "Sadhguru — Isha Foundation", url: "https://www.youtube.com/@sadhguru", verified: true },
  ],
  disclaimer: "Consult your doctor before starting any new physical exercise routine."
};

export function YogaRoutineModal({
  visible,
  onClose,
  onOpenVideo,
  customTitle,
  customDuration,
  customLevel,
  customRoutine,
}: YogaRoutineModalProps & { customRoutine?: any }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [routine, setRoutine] = useState<any>(customRoutine || DEFAULT_YOGA_ROUTINE);

  const yogaDoneKey = () => {
    const d = new Date();
    return `yoga_done_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (visible) {
      if (customRoutine) {
        setRoutine(customRoutine);
      } else {
        get<any>(K.yogaTip).then((tip) => {
          if (tip && tip.steps && tip.steps.length > 0) {
            setRoutine(tip);
          } else {
            setRoutine(DEFAULT_YOGA_ROUTINE);
          }
        });
      }
      get<any>(yogaDoneKey()).then((d) => {
        if (Array.isArray(d)) setCompletedSteps(d);
        else if (d === true) setCompletedSteps([1, 2, 3, 4, 5]);
        else setCompletedSteps([]);
      });
    }
  }, [visible, customRoutine]);

  const safeCompletedSteps = Array.isArray(completedSteps) ? completedSteps : [];
  const isStepDone = (num: number) => safeCompletedSteps.includes(num);

  const toggleStepDone = async (step: YogaStep) => {
    const num = step.num;
    const isDone = isStepDone(num);
    const next = isDone ? safeCompletedSteps.filter((n) => n !== num) : [...safeCompletedSteps, num];
    setCompletedSteps(next);
    await set(yogaDoneKey(), next);

    const d = new Date();
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const logItem = {
      id: `yoga_${step.num}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: dStr,
      step_num: step.num,
      step_name: step.name,
      completed: !isDone,
    };
    track("yoga_done", { step: step.name, num: step.num, completed: !isDone });

    const historyCache = (await get<any[]>(K.history)) || [];
    historyCache.unshift({
      id: logItem.id,
      timestamp: logItem.timestamp,
      type: "yoga",
      title: step.name,
      description: `Completed ${step.name} (${step.duration})`,
      status: "completed",
    });
    await set(K.history, [...historyCache]);
  };

  const activeRoutine = routine || DEFAULT_YOGA_ROUTINE;
  const title = customTitle || activeRoutine.title;
  const duration = customDuration || activeRoutine.duration;
  const level = customLevel || activeRoutine.level;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.ovl}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={s.safeContainer} edges={["bottom"]}>
          <View style={[s.sBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, paddingBottom: Math.max(insets.bottom, 16) }]}>
            
            {/* Handle Bar */}
            <View style={[s.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />

            {/* Header row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={14} color={theme.accent} />
                <Text style={{ fontSize: 11, letterSpacing: 0.8, color: theme.accent, fontWeight: "700" }}>
                  {t("yoga.aiRecommended", "AI RECOMMENDED YOGA")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", alignItems: "center", justifyContent: "center" }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[s.sTitle, { color: theme.textPrimary }]}>{title}</Text>
            
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 6 }}>
              <View style={[s.chip, { backgroundColor: theme.accentBg }]}>
                <Ionicons name="time-outline" size={11} color={theme.accent} />
                <Text style={[s.chipT, { color: theme.accent }]}>{duration}</Text>
              </View>
              <View style={[s.chip, { backgroundColor: theme.accentBg }]}>
                <Ionicons name="speedometer-outline" size={11} color={theme.accent} />
                <Text style={[s.chipT, { color: theme.accent }]}>{level}</Text>
              </View>
            </View>

            <Text style={[s.cS, { color: theme.textSecondary, lineHeight: 17, marginBottom: 8 }]}>{activeRoutine.description}</Text>
            
            <Text style={[s.secL, { color: theme.accent }]}>
              ROUTINE · {safeCompletedSteps.length}/{(activeRoutine.steps || []).length} {t("yoga.doneToday", "done today")}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1, maxHeight: 380 }}>
              {(activeRoutine.steps || []).map((step: YogaStep) => {
                const stepDone = isStepDone(step.num);
                return (
                  <View
                    key={step.num}
                    style={[
                      s.card,
                      {
                        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                        borderColor: theme.surfaceBorder,
                        gap: 8,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.cI, { backgroundColor: theme.accentBg, borderRadius: 13 }, stepDone && { backgroundColor: "rgba(74,222,128,0.18)" }]}>
                        {stepDone ? (
                          <Ionicons name="checkmark" size={14} color="#10b981" />
                        ) : (
                          <Text style={{ fontSize: 11, color: theme.accent, fontWeight: "700" }}>{step.num}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cT, { color: theme.textPrimary }]}>{step.name}</Text>
                        <Text style={[s.cS, { color: theme.textSecondary }]}>{step.duration}</Text>
                        {step.benefit ? <Text style={[s.cS, { color: theme.accent, marginTop: 2 }]}>{step.benefit}</Text> : null}
                      </View>
                    </View>

                    {/* Video Player Launcher */}
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
                        borderRadius: 10,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
                      }}
                      onPress={() =>
                        onOpenVideo({
                          url: step.youtube_video || "https://www.youtube.com/watch?v=QPjwawKxuLw",
                          title: step.name,
                          channel: step.channel || "Ministry of AYUSH",
                          benefit: step.benefit,
                          step: step,
                        })
                      }
                    >
                      <Ionicons name="play-circle" size={18} color="#ef4444" />
                      <Text style={{ fontSize: 12, color: theme.textPrimary, flex: 1, fontWeight: "700" }}>
                        Watch Video Inside App
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.accent, fontWeight: "600" }}>
                        {step.channel || "AYUSH"}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={theme.accent} />
                    </TouchableOpacity>

                    {/* Mark Done Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 2,
                        backgroundColor: stepDone
                          ? "rgba(16, 185, 129, 0.12)"
                          : isDark
                          ? "rgba(255,255,255,0.06)"
                          : "#ffffff",
                        borderRadius: 10,
                        padding: 9,
                        borderWidth: 1,
                        borderColor: stepDone ? "rgba(16, 185, 129, 0.3)" : theme.surfaceBorder,
                      }}
                      onPress={() => toggleStepDone(step)}
                    >
                      <Ionicons
                        name={stepDone ? "checkmark-circle" : "ellipse-outline"}
                        size={15}
                        color={stepDone ? "#10b981" : theme.textSecondary}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: stepDone ? "#10b981" : theme.textSecondary,
                          fontWeight: "600",
                        }}
                      >
                        {stepDone ? t("yoga.markedDone", "Marked as Done") : t("yoga.markDone", "Mark as Done")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Verified Sources */}
              <Text style={[s.secL, { color: theme.accent, marginTop: 10, marginBottom: 6 }]}>
                {t("yoga.verifiedChannels", "VERIFIED SOURCES")}
              </Text>
              {(activeRoutine.channels || []).map((ch: any) => (
                <TouchableOpacity
                  key={ch.url}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.surfaceBorder,
                  }}
                  onPress={() => Linking.openURL(ch.url)}
                >
                  <Ionicons name="logo-youtube" size={16} color="#ef4444" />
                  <Text style={{ fontSize: 12, color: theme.textPrimary, flex: 1 }}>{ch.name}</Text>
                  {ch.verified && (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, color: "#10b981", fontWeight: "700" }}>✓ VERIFIED</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <Text style={[s.cS, { color: theme.textSecondary, fontStyle: "italic", marginTop: 8, marginBottom: 12, lineHeight: 15 }]}>
                {routine.disclaimer}
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  ovl: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  safeContainer: {
    justifyContent: "flex-end",
  },
  sBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 18,
    gap: 8,
    maxHeight: "92%",
    width: "100%",
    zIndex: 10,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipT: {
    fontSize: 10,
    fontWeight: "600",
  },
  cS: {
    fontSize: 11,
  },
  secL: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 4,
  },
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  cI: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cT: {
    fontSize: 13,
    fontWeight: "700",
  },
});
