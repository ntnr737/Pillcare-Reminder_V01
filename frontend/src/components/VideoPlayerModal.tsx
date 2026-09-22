import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Web platform WebView import fallback
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}
}

const BG = "#0B0D14";
const SF = "#161926";
const TX = "#F9FAFB";
const TM = "rgba(249, 250, 251, 0.65)";
const A3 = "#A78BFA";
const BD = "rgba(255, 255, 255, 0.08)";
const SUCCESS = "#4ade80";

export interface VideoPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  channel?: string;
  benefit?: string;
  onCompleteSession?: (watchedSeconds: number, feeling: string) => void;
}

export function extractYouTubeId(url?: string): string {
  if (!url) return "QPjwawKxuLw";
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const embedMatch = url.match(/embed\/([^?&]+)/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];
  return "QPjwawKxuLw";
}

const FEELING_OPTIONS = [
  { id: "energized", label: "Energized & Alert", icon: "flash", color: "#F59E0B" },
  { id: "relaxed", label: "Deeply Relaxed", icon: "leaf", color: "#10B981" },
  { id: "relieved", label: "Stiffness Relieved", icon: "body", color: "#3B82F6" },
  { id: "calm", label: "Balanced & Calmer", icon: "heart", color: "#EC4899" },
];

export function VideoPlayerModal({
  visible,
  onClose,
  videoUrl,
  title,
  channel,
  benefit,
  onCompleteSession,
}: VideoPlayerModalProps) {
  const insets = useSafeAreaInsets();
  const [hasError, setHasError] = useState(false);
  const [secondsWatched, setSecondsWatched] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [modalStep, setModalStep] = useState<"player" | "feedback">("player");
  const [selectedFeeling, setSelectedFeeling] = useState<string>("energized");

  useEffect(() => {
    if (visible) {
      setHasError(false);
      setSecondsWatched(0);
      setIsTimerActive(true);
      setModalStep("player");
      setSelectedFeeling("energized");
    } else {
      setIsTimerActive(false);
    }
  }, [visible, videoUrl]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSecondsWatched((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const videoId = extractYouTubeId(videoUrl);
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https://www.youtube.com`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0B0D14; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    iframe { width: 100%; height: 100%; border: 0; border-radius: 12px; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    title="${(title || "Yoga Video").replace(/"/g, '&quot;')}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>
</body>
</html>`;

  const handleExternalOpen = () => {
    const rawUrl = videoUrl || `https://www.youtube.com/watch?v=${videoId}`;
    Linking.openURL(rawUrl).catch(() => {});
  };

  const handleProceedToFeedback = () => {
    setIsTimerActive(false);
    setModalStep("feedback");
  };

  const handleSaveAndLog = () => {
    if (onCompleteSession) {
      onCompleteSession(secondsWatched, selectedFeeling);
    }
    onClose();
  };

  const getClinicalInsight = () => {
    const poseName = title || "Yoga Pose";
    const mins = Math.max(0.5, (secondsWatched / 60)).toFixed(1);
    switch (selectedFeeling) {
      case "energized":
        return `Practicing ${poseName} for ${mins} mins stimulated your sympathetic circulation and cellular oxygen uptake. Regular daily practice reinforces metabolic endurance!`;
      case "relaxed":
        return `Your ${mins} min ${poseName} practice triggered vagal nerve stimulation and lowered serum cortisol. Feeling relaxed confirms active parasympathetic recovery!`;
      case "relieved":
        return `${poseName} decompression increased synovial joint lubrication and reduced spinal compression during your ${mins} min session.`;
      default:
        return `Consistent ${mins} min practice of ${poseName} builds neuro-muscular habit strength and complements your daily wellness routine.`;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <SafeAreaView style={s.safeContainer} edges={["top", "bottom"]}>
          <TouchableOpacity activeOpacity={1} style={[s.cardContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Modal Top Header */}
            <View style={s.headerRow}>
              <View style={s.headerLeft}>
                <View style={s.iconBadge}>
                  <Ionicons name={modalStep === "player" ? "sparkles" : "checkmark-done-circle"} size={18} color={A3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.titleText} numberOfLines={1}>
                    {modalStep === "player" ? title || "Guided Studio Session" : "Post-Pose Reflection"}
                  </Text>
                  <Text style={s.channelText} numberOfLines={1}>
                    {modalStep === "player" ? (channel ? `${channel} • Verified` : "AI Guided Pose") : "Clinical Insights & Habit Log"}
                  </Text>
                </View>
              </View>

              {/* Live Session Timer Badge */}
              <View style={s.timerBadge}>
                <Ionicons name="stopwatch-outline" size={14} color={A3} />
                <Text style={s.timerText}>{formatTimer(secondsWatched)}</Text>
              </View>

              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>

            {modalStep === "player" ? (
              <>
                {/* Embedded Video Player */}
                <View style={s.playerWrapper}>
                  {hasError ? (
                    <View style={s.fallbackContainer}>
                      <Ionicons name="logo-youtube" size={44} color="#FF0000" />
                      <Text style={s.fallbackText}>Playback Restricted on WebView</Text>
                      <TouchableOpacity onPress={handleExternalOpen} style={s.playBtn}>
                        <Text style={s.playBtnText}>Play in YouTube App</Text>
                      </TouchableOpacity>
                    </View>
                  ) : Platform.OS === "web" ? (
                    <iframe
                      src={embedUrl}
                      title={title || "Yoga Video"}
                      style={{ width: "100%", height: "100%", border: 0, borderRadius: 12 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : WebView ? (
                    <WebView
                      source={{ html: htmlContent, baseUrl: "https://www.youtube.com" }}
                      style={{ flex: 1, borderRadius: 12, backgroundColor: BG }}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      javaScriptEnabled
                      domStorageEnabled
                      originWhitelist={["*"]}
                      userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                      startInLoadingState={true}
                      onError={() => setHasError(true)}
                      onHttpError={() => setHasError(true)}
                      renderLoading={() => (
                        <View style={s.loadingContainer}>
                          <ActivityIndicator size="small" color={A3} />
                        </View>
                      )}
                    />
                  ) : (
                    <View style={s.fallbackContainer}>
                      <Ionicons name="logo-youtube" size={48} color="#FF0000" />
                      <Text style={s.fallbackText}>Tap below to play video</Text>
                      <TouchableOpacity onPress={handleExternalOpen} style={s.playBtn}>
                        <Text style={s.playBtnText}>Open Video Player</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Clinical Benefit Callout */}
                {benefit ? (
                  <View style={s.benefitCard}>
                    <Ionicons name="bulb-outline" size={16} color={A3} />
                    <Text style={s.benefitText}>{benefit}</Text>
                  </View>
                ) : null}

                {/* Footer Controls */}
                <View style={s.footerRow}>
                  <TouchableOpacity onPress={handleExternalOpen} style={s.externalBtn} activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={13} color={TM} />
                    <Text style={s.externalBtnText}>Open YouTube</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleProceedToFeedback} style={s.completeBtn} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={s.completeBtnText}>Finish & Reflect</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Step 2: Post-Pose Feeling Reflection & Insight */
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.feedbackContainer}>
                <View style={s.summaryBox}>
                  <Text style={s.summaryTitle}>SESSION COMPLETED 🔥</Text>
                  <Text style={s.summaryTime}>
                    Total Practice Time: <Text style={{ color: A3, fontWeight: "700" }}>{formatTimer(secondsWatched)}</Text>
                  </Text>
                </View>

                <Text style={s.questionText}>How do you feel after this pose?</Text>

                {/* Feeling Options */}
                <View style={s.feelingsGrid}>
                  {FEELING_OPTIONS.map((item) => {
                    const isSelected = selectedFeeling === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[s.feelingCard, isSelected && { borderColor: item.color, backgroundColor: `${item.color}15` }]}
                        onPress={() => setSelectedFeeling(item.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={item.icon as any} size={20} color={isSelected ? item.color : TM} />
                        <Text style={[s.feelingLabel, isSelected && { color: TX, fontWeight: "700" }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Dynamic Clinical Insight Box */}
                <View style={s.insightCard}>
                  <View style={s.insightHeader}>
                    <Ionicons name="pulse" size={16} color={SUCCESS} />
                    <Text style={s.insightTitle}>AYUSH & CLINICAL INSIGHT</Text>
                  </View>
                  <Text style={s.insightBody}>{getClinicalInsight()}</Text>
                </View>

                {/* Save Progress Action */}
                <TouchableOpacity onPress={handleSaveAndLog} style={s.saveBtn} activeOpacity={0.8}>
                  <Ionicons name="heart-circle" size={18} color="#FFF" />
                  <Text style={s.saveBtnText}>Save Practice to Habit Log</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "flex-end",
  },
  safeContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  cardContainer: {
    backgroundColor: SF,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BD,
    padding: 18,
    gap: 14,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: TX,
  },
  channelText: {
    fontSize: 11,
    color: TM,
    marginTop: 1,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
  },
  timerText: {
    fontSize: 12,
    fontWeight: "700",
    color: A3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: BG,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BD,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  fallbackText: {
    fontSize: 13,
    color: TM,
  },
  playBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FF0000",
    borderRadius: 8,
  },
  playBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  benefitText: {
    fontSize: 12,
    color: TX,
    flex: 1,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  externalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  externalBtnText: {
    fontSize: 11,
    color: TM,
    fontWeight: "600",
  },
  completeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#8B5CF6",
  },
  completeBtnText: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "700",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  summaryBox: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BD,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: SUCCESS,
  },
  summaryTime: {
    fontSize: 13,
    color: TX,
    marginTop: 3,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "700",
    color: TX,
    textAlign: "center",
    marginTop: 4,
  },
  feelingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feelingCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BD,
  },
  feelingLabel: {
    fontSize: 12,
    color: TM,
    fontWeight: "600",
  },
  insightCard: {
    backgroundColor: "rgba(74, 222, 128, 0.08)",
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.25)",
    gap: 6,
    marginTop: 4,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: SUCCESS,
  },
  insightBody: {
    fontSize: 12,
    color: TX,
    lineHeight: 17,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  saveBtnText: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "700",
  },
});
