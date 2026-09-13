import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
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

export interface VideoPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  channel?: string;
  benefit?: string;
  onCompleteSession?: () => void;
}

export function extractYouTubeId(url?: string): string {
  if (!url) return "QPjwawKxuLw"; // Default Swami Ramdev Yoga Fallback
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const embedMatch = url.match(/embed\/([^?&]+)/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];
  return "QPjwawKxuLw";
}

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
  const videoId = extractYouTubeId(videoUrl);
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;

  const handleExternalOpen = () => {
    const rawUrl = videoUrl || `https://www.youtube.com/watch?v=${videoId}`;
    Linking.openURL(rawUrl).catch(() => {});
  };

  const handleDoneSession = () => {
    if (onCompleteSession) {
      onCompleteSession();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <SafeAreaView style={s.safeContainer} edges={["top", "bottom"]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation?.()}
            style={[s.cardContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            {/* Modal Header */}
            <View style={s.headerRow}>
              <View style={s.headerLeft}>
                <View style={s.iconBadge}>
                  <Ionicons name="play-circle" size={18} color="#FF0000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.titleText} numberOfLines={1}>
                    {title || "Yoga Session"}
                  </Text>
                  {channel ? (
                    <Text style={s.channelText} numberOfLines={1}>
                      {channel} • Verified Instructor
                    </Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>

            {/* Video Player Container */}
            <View style={s.playerWrapper}>
              {Platform.OS === "web" ? (
                // HTML5 Iframe for Web Browser
                <iframe
                  src={embedUrl}
                  title={title || "Yoga Video"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    borderRadius: 12,
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : WebView ? (
                // Native WebView for iOS / Android
                <WebView
                  source={{ uri: embedUrl }}
                  style={{ flex: 1, borderRadius: 12, backgroundColor: BG }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={s.loadingContainer}>
                      <ActivityIndicator size="small" color={A3} />
                    </View>
                  )}
                  renderError={() => (
                    <View style={s.offlineFallbackContainer}>
                      <Ionicons name="cloud-offline-outline" size={38} color={A3} />
                      <Text style={s.offlineTitle}>Video Unavailable Offline</Text>
                      <Text style={s.offlineSub}>
                        Internet connection required to stream YouTube video.
                      </Text>
                    </View>
                  )}
                />
              ) : (
                // Native Fallback
                <View style={s.fallbackContainer}>
                  <Ionicons name="logo-youtube" size={48} color="#FF0000" />
                  <Text style={s.fallbackText}>Tap below to play video</Text>
                  <TouchableOpacity onPress={handleExternalOpen} style={s.playBtn}>
                    <Text style={s.playBtnText}>Open Video Player</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Health Benefit Callout */}
            {benefit ? (
              <View style={s.benefitCard}>
                <Ionicons name="sparkles" size={14} color={A3} />
                <Text style={s.benefitText}>{benefit}</Text>
              </View>
            ) : null}

            {/* Footer Actions */}
            <View style={s.footerRow}>
              <TouchableOpacity
                onPress={handleExternalOpen}
                style={s.externalBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={13} color={TM} />
                <Text style={s.externalBtnText}>Open in YouTube App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDoneSession}
                style={s.doneBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={15} color="#4ade80" />
                <Text style={s.doneBtnText}>Complete & Log Session</Text>
              </TouchableOpacity>
            </View>
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
    gap: 12,
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
    backgroundColor: "rgba(255, 0, 0, 0.12)",
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  externalBtnText: {
    fontSize: 11,
    color: TM,
    fontWeight: "600",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  doneBtnText: {
    fontSize: 13,
    color: "#4ade80",
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
  offlineFallbackContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 6,
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TX,
    marginTop: 4,
  },
  offlineSub: {
    fontSize: 11,
    color: TM,
    textAlign: "center",
  },
});
