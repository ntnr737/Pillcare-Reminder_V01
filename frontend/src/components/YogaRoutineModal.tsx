import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { get, set, K } from "@/src/lib/store";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";

const BG = "#0B0D14";
const SF = "#161926";
const TX = "#F9FAFB";
const TM = "rgba(249, 250, 251, 0.65)";
const A3 = "#A78BFA";
const BD = "rgba(255, 255, 255, 0.08)";

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
    { num: 1, name: "Surya Namaskar (Sun Salutation)", duration: "3 min", benefit: "Activates metabolism and improves circulation, supporting thyroid function.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=1W_Q4m0sD78" },
    { num: 2, name: "Sarvangasana (Shoulder Stand)", duration: "3 min", benefit: "Increases blood flow to the neck area, stimulating the thyroid gland.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=L3F4z7t8_2w" },
    { num: 3, name: "Matsyasana (Fish Pose)", duration: "3 min", benefit: "Stretches the neck and throat region, relieving neck tension.", channel: "Swami Ramdev", youtube_video: "https://www.youtube.com/watch?v=QPjwawKxuLw" },
    { num: 4, name: "Bhujangasana (Cobra Pose)", duration: "3 min", benefit: "Opens the chest and throat, boosting energy and flexibility.", channel: "Sadhguru", youtube_video: "https://www.youtube.com/watch?v=QPjwawKxuLw" },
    { num: 5, name: "Ustrasana (Camel Pose)", duration: "3 min", benefit: "Enhances respiratory and endocrine health through gentle back extension.", channel: "Ministry of AYUSH", youtube_video: "https://www.youtube.com/watch?v=1W_Q4m0sD78" }
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
}: YogaRoutineModalProps) {
  const insets = useSafeAreaInsets();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const yogaDoneKey = () => {
    const d = new Date();
    return `yoga_done_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (visible) {
      get<any>(yogaDoneKey()).then((d) => {
        if (Array.isArray(d)) setCompletedSteps(d);
        else if (d === true) setCompletedSteps([1, 2, 3, 4, 5]);
        else setCompletedSteps([]);
      });
    }
  }, [visible]);

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
    const hStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const historyCache = (await get<any[]>(K.history)) || [];

    let dayItem = historyCache.find((item: any) => item.date === dStr);
    if (!dayItem) {
      dayItem = { date: dStr, total: 0, taken: 0, entries: [] };
      historyCache.unshift(dayItem);
    }

    if (!isDone) {
      const newEntry = {
        id: `yoga_${num}_${Date.now()}`,
        name: `Yoga: ${step.name || "Therapy Pose"}`,
        generic_name: "AI Yoga Therapy",
        dosage: "",
        unit: "",
        time: hStr,
        status: "yoga_completed",
        note: `Completed ${step.duration || "pose"}`,
      };
      if (!dayItem.entries.some((e: any) => e.name === newEntry.name)) {
        dayItem.entries.push(newEntry);
      }
      track("yoga_done", { pose: step.name });
      api.yogaComplete(num, step.name, step.youtube_video || step.youtube_channel).catch(() => {});
    } else {
      dayItem.entries = dayItem.entries.filter((e: any) => e.name !== `Yoga: ${step.name}`);
      api.yogaUncomplete(num, step.name).catch(() => {});
    }
    await set(K.history, [...historyCache]);
  };

  const routine = DEFAULT_YOGA_ROUTINE;
  const title = customTitle || routine.title;
  const duration = customDuration || routine.duration;
  const level = customLevel || routine.level;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.ovl} activeOpacity={1} onPress={onClose}>
        <SafeAreaView style={s.safeContainer} edges={["top", "bottom"]}>
          <View
            style={[s.sBox, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            {/* Header row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sparkles" size={12} color={A3} />
                <Text style={{ fontSize: 10, letterSpacing: 1, color: A3, fontWeight: "700" }}>AI RECOMMENDED YOGA</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={TM} />
              </TouchableOpacity>
            </View>

            <Text style={s.sTitle}>{title}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 6 }}>
              <View style={s.chip}>
                <Ionicons name="time-outline" size={11} color={A3} />
                <Text style={s.chipT}>{duration}</Text>
              </View>
              <View style={s.chip}>
                <Ionicons name="speedometer-outline" size={11} color={A3} />
                <Text style={s.chipT}>{level}</Text>
              </View>
            </View>

            <Text style={[s.cS, { lineHeight: 16, marginBottom: 8 }]}>{routine.description}</Text>
            <Text style={s.secL}>
              ROUTINE · {safeCompletedSteps.length}/{routine.steps.length} done today
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {routine.steps.map((step) => {
                const stepDone = isStepDone(step.num);
                return (
                  <View key={step.num} style={[s.card, { gap: 8, marginBottom: 8 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.cI, { borderRadius: 13 }, stepDone && { backgroundColor: "rgba(74,222,128,0.18)" }]}>
                        {stepDone ? (
                          <Ionicons name="checkmark" size={14} color="#4ade80" />
                        ) : (
                          <Text style={{ fontSize: 11, color: A3, fontWeight: "700" }}>{step.num}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cT}>{step.name}</Text>
                        <Text style={s.cS}>{step.duration}</Text>
                        {step.benefit ? <Text style={[s.cS, { color: A3, marginTop: 2 }]}>{step.benefit}</Text> : null}
                      </View>
                    </View>

                    {/* Video Player Launcher */}
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "rgba(255,0,0,0.12)",
                        borderRadius: 8,
                        padding: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255,0,0,0.3)",
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
                      <Ionicons name="play-circle" size={16} color="#FF0000" />
                      <Text style={{ fontSize: 11, color: TX, flex: 1, fontWeight: "700" }}>Watch Video Inside App</Text>
                      <Text style={{ fontSize: 9, color: A3, fontWeight: "600" }}>{step.channel || "AYUSH"}</Text>
                      <Ionicons name="chevron-forward" size={12} color={A3} />
                    </TouchableOpacity>

                    {/* Mark Done Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 2,
                        backgroundColor: stepDone ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        padding: 8,
                        borderWidth: 1,
                        borderColor: stepDone ? "rgba(74,222,128,0.3)" : BD,
                      }}
                      onPress={() => toggleStepDone(step)}
                    >
                      <Ionicons name={stepDone ? "checkmark-circle" : "ellipse-outline"} size={14} color={stepDone ? "#4ade80" : TM} />
                      <Text style={{ fontSize: 11, color: stepDone ? "#4ade80" : TM, fontWeight: "600" }}>
                        {stepDone ? "Marked as Done" : "Mark as Done"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Verified Sources */}
              <Text style={[s.secL, { marginTop: 10, marginBottom: 6 }]}>VERIFIED SOURCES</Text>
              {routine.channels.map((ch) => (
                <TouchableOpacity
                  key={ch.url}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BD }}
                  onPress={() => Linking.openURL(ch.url)}
                >
                  <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                  <Text style={{ fontSize: 11, color: TX, flex: 1 }}>{ch.name}</Text>
                  {ch.verified && (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(74,222,128,0.15)", borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, color: "#4ade80", fontWeight: "700" }}>✓ VERIFIED</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <Text style={[s.cS, { fontStyle: "italic", marginTop: 8, marginBottom: 12, lineHeight: 15 }]}>{routine.disclaimer}</Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  ovl: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  safeContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sBox: {
    backgroundColor: SF,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BD,
    padding: 18,
    gap: 8,
    maxHeight: "92%",
    zIndex: 10,
    elevation: 10,
  },
  sTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TX,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipT: {
    fontSize: 10,
    color: A3,
    fontWeight: "600",
  },
  cS: {
    fontSize: 11,
    color: TM,
  },
  secL: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: A3,
    marginTop: 6,
    marginBottom: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BD,
  },
  cI: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cT: {
    fontSize: 13,
    fontWeight: "700",
    color: TX,
  },
});
