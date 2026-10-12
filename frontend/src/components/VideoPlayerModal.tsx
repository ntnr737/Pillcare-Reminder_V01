import React, { useEffect, useState, useRef } from "react";
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
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as ScreenOrientation from "expo-screen-orientation";
import { get, set, K } from "@/src/lib/store";
import { api } from "@/src/lib/api";

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
  if (!url) return "v7AYKMP6rOE";

  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch && watchMatch[1] && watchMatch[1].length === 11) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch && shortMatch[1] && shortMatch[1].length === 11) return shortMatch[1];
  const embedMatch = url.match(/embed\/([^?&]+)/);
  if (embedMatch && embedMatch[1] && embedMatch[1].length === 11) return embedMatch[1];
  return "v7AYKMP6rOE";
}

const FEELING_OPTIONS = [
  { id: "energized", label: "Energized & Alert", icon: "flash", color: "#F59E0B" },
  { id: "relaxed", label: "Deeply Relaxed", icon: "leaf", color: "#10B981" },
  { id: "relieved", label: "Stiffness Relieved", icon: "body", color: "#3B82F6" },
  { id: "calm", label: "Balanced & Calmer", icon: "heart", color: "#EC4899" },
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

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
  const webViewRef = useRef<any>(null);
  const [hasError, setHasError] = useState(false);
  const [secondsWatched, setSecondsWatched] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalStep, setModalStep] = useState<"player" | "feedback">("player");
  const [selectedFeeling, setSelectedFeeling] = useState<string>("energized");

  // YouTube Full Feature States
  const [playerMode, setPlayerMode] = useState<"focus" | "youtube_web">("focus");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    if (visible) {
      setHasError(false);
      setPlayerMode("focus");
      setSecondsWatched(0);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackRate(1.0);
      setShowSpeedMenu(false);
      setIsPlaying(true);
      setIsTimerActive(true);
      setIsMuted(false);
      setIsFullscreen(false);
      setModalStep("player");
      setSelectedFeeling("energized");
    } else {
      setIsPlaying(false);
      setIsTimerActive(false);
      if (isFullscreen) {
        setIsFullscreen(false);
        try {
          if (ScreenOrientation?.OrientationLock?.PORTRAIT_UP) {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
          }
        } catch {}
      }
    }
  }, [visible, videoUrl]);

  // Handle messages from WebView JS Bridge
  const handleWebViewMessage = (event: any) => {
    try {
      const data = typeof event.nativeEvent.data === "string" ? JSON.parse(event.nativeEvent.data) : event.nativeEvent.data;
      if (!data) return;

      if (data.type === "YT_TIME_UPDATE") {
        if (data.currentTime !== undefined) setCurrentTime(data.currentTime);
        if (data.duration !== undefined && data.duration > 0) setDuration(data.duration);
      } else if (data.type === "YT_STATE_CHANGE") {
        // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
        if (data.state === 1) {
          setIsPlaying(true);
          setIsTimerActive(true);
        } else if (data.state === 2 || data.state === 0) {
          setIsPlaying(false);
          setIsTimerActive(false);
        }
      } else if (data.type === "YT_ERROR") {
        console.warn("YouTube player error:", data.code);
      }
    } catch (e) {}
  };

  // Web platform YouTube iframe API message listener
  useEffect(() => {
    if (Platform.OS === "web" && visible) {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data && data.type === "YT_STATE_CHANGE") {
            if (data.state === 1) {
              setIsPlaying(true);
              setIsTimerActive(true);
            } else {
              setIsPlaying(false);
              setIsTimerActive(false);
            }
          }
        } catch {}
      };
      window.addEventListener("message", handleWebMessage);
      return () => window.removeEventListener("message", handleWebMessage);
    }
  }, [visible]);

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

  const saveVideoLogToHistory = async (watchedSecs: number, feeling?: string) => {
    if (watchedSecs <= 0) return;
    try {
      const d = new Date();
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const historyCache = (await get<any[]>(K.history)) || [];

      let dayItem = historyCache.find((item: any) => item.date === dStr);
      if (!dayItem) {
        dayItem = { date: dStr, total: 0, taken: 0, entries: [] };
        historyCache.unshift(dayItem);
      }

      const mins = Math.floor(watchedSecs / 60);
      const secs = watchedSecs % 60;
      const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const poseTitle = title || "Yoga Practice";

      const selectedFeelingObj = FEELING_OPTIONS.find((f) => f.id === feeling);
      const feelingText = selectedFeelingObj ? ` · Felt: ${selectedFeelingObj.label}` : feeling ? ` · Felt: ${feeling}` : "";

      const logId = `yoga_video_${Date.now()}`;
      const newEntry = {
        id: logId,
        name: `Yoga: ${poseTitle}`,
        generic_name: channel || "Guided Yoga Practice",
        dosage: `${durationLabel} video played`,
        unit: "",
        time: hStr,
        status: "yoga_completed",
        note: `Watched ${durationLabel} of ${poseTitle}${feelingText}`,
      };

      const existingIdx = dayItem.entries.findIndex(
        (e: any) => e.name === newEntry.name && e.time === hStr
      );
      if (existingIdx >= 0) {
        dayItem.entries[existingIdx] = newEntry;
      } else {
        dayItem.entries.unshift(newEntry);
      }

      await set(K.history, [...historyCache]);
      api.yogaComplete(0, poseTitle, videoUrl).catch(() => {});
    } catch (err) {
      console.warn("Failed to save yoga video playback log:", err);
    }
  };

  const handleCloseModal = () => {
    if (isFullscreen) {
      try {
        if (ScreenOrientation?.OrientationLock?.PORTRAIT_UP) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        }
      } catch {}
    }
    if (secondsWatched > 3) {
      saveVideoLogToHistory(secondsWatched, selectedFeeling);
    }
    onClose();
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          try {
            var v = document.querySelector('video');
            if (v) { v.muted = false; v.volume = 1.0; v.play(); }
            if (window.unmuteAudio) { window.unmuteAudio(); }
            if (window.player && window.player.unMute) { window.player.unMute(); window.player.setVolume(100); }
          } catch(e) {}
          true;
        `);
      }
    } else {
      setIsMuted(true);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          try {
            var v = document.querySelector('video');
            if (v) { v.muted = true; }
            if (window.muteAudio) { window.muteAudio(); }
            if (window.player && window.player.mute) { window.player.mute(); }
          } catch(e) {}
          true;
        `);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (ScreenOrientation?.OrientationLock?.LANDSCAPE) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
      } catch (e) {
        console.warn("Screen orientation landscape lock failed:", e);
      }
    } else {
      setIsFullscreen(false);
      try {
        if (ScreenOrientation?.OrientationLock?.PORTRAIT_UP) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (e) {
        console.warn("Screen orientation portrait lock failed:", e);
      }
    }
  };

  const toggleTimerPlayPause = () => {
    setIsPlaying((prev) => !prev);
    setIsTimerActive((prev) => !prev);
  };

  const videoId = extractYouTubeId(videoUrl);
  const directEmbedUri = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&origin=https://www.youtube.com&widget_referrer=https://www.youtube.com&rel=0&modestbranding=1`;
  const mobileWatchUri = `https://m.youtube.com/watch?v=${videoId}`;
  const [useMobileWeb, setUseMobileWeb] = useState(false);

  const getYouTubeEmbedHtml = (vidId: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; background-color: #0B0D14; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #0B0D14; display: flex; align-items: center; justify-content: center; }
        .player-wrapper { position: relative; width: 100%; height: 100%; }
        #player { width: 100%; height: 100%; border: none; border-radius: 12px; }
      </style>
    </head>
    <body>
      <div class="player-wrapper">
        <div id="player"></div>
      </div>
      <script>
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        var player;
        function onYouTubeIframeAPIReady() {
          player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: '${vidId}',
            host: 'https://www.youtube.com',
            playerVars: {
              'autoplay': 1,
              'playsinline': 1,
              'enablejsapi': 1,
              'origin': 'https://www.youtube.com',
              'rel': 0,
              'modestbranding': 1,
              'controls': 1
            },
            events: {
              'onReady': onPlayerReady,
              'onStateChange': onPlayerStateChange,
              'onError': onPlayerError
            }
          });
        }

        function onPlayerReady(event) {
          try {
            event.target.unMute();
            event.target.setVolume(100);
            event.target.playVideo();
          } catch(e){}

          // Poll current time & duration every 500ms
          setInterval(function() {
            try {
              if (player && player.getCurrentTime) {
                var c = player.getCurrentTime();
                var d = player.getDuration();
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'YT_TIME_UPDATE',
                    currentTime: c,
                    duration: d
                  }));
                }
              }
            } catch(e){}
          }, 500);
        }

        window.unmuteAudio = function() {
          try {
            if (player) {
              if (player.unMute) player.unMute();
              if (player.setVolume) player.setVolume(100);
              if (player.playVideo) player.playVideo();
            }
          } catch(e){}
        };

        window.muteAudio = function() {
          try {
            if (player && player.mute) player.mute();
          } catch(e){}
        };

        function onPlayerStateChange(event) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'YT_STATE_CHANGE', 
              state: event.data 
            }));
          }
        }

        function onPlayerError(event) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'YT_ERROR', code: event.data }));
          }
        }
      </script>
    </body>
    </html>
  `;

  const seekRelative = (offsetSecs: number) => {
    const target = Math.max(0, Math.min(duration || 300, currentTime + offsetSecs));
    setCurrentTime(target);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        try {
          if (window.player && window.player.seekTo) {
            window.player.seekTo(${target}, true);
          }
        } catch(e) {}
        true;
      `);
    }
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        try {
          if (window.player && window.player.setPlaybackRate) {
            window.player.setPlaybackRate(${rate});
          }
        } catch(e) {}
        true;
      `);
    }
  };

  const togglePlayPausePlayer = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsTimerActive(false);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          try {
            if (window.player && window.player.pauseVideo) { window.player.pauseVideo(); }
          } catch(e) {}
          true;
        `);
      }
    } else {
      setIsPlaying(true);
      setIsTimerActive(true);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          try {
            if (window.player && window.player.playVideo) { window.player.playVideo(); }
          } catch(e) {}
          true;
        `);
      }
    }
  };

  const handleExternalOpen = () => {
    const rawUrl = videoUrl || `https://www.youtube.com/watch?v=${videoId}`;
    Linking.openURL(rawUrl).catch(() => {});
  };

  const handleInAppBrowser = async () => {
    try {
      setIsPlaying(true);
      setIsTimerActive(true);
      const targetUrl = videoUrl || `https://www.youtube.com/watch?v=${videoId}`;
      await WebBrowser.openBrowserAsync(targetUrl, {
        toolbarColor: "#161926",
        controlsColor: "#A78BFA",
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch {
      handleExternalOpen();
    } finally {
      setIsPlaying(false);
      setIsTimerActive(false);
    }
  };

  const handleProceedToFeedback = () => {
    setIsTimerActive(false);
    setIsPlaying(false);
    setModalStep("feedback");
  };

  const handleSaveAndLog = () => {
    saveVideoLogToHistory(secondsWatched, selectedFeeling);
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

  if (visible && isFullscreen) {
    return (
      <Modal visible={visible} transparent={false} animationType="none" onRequestClose={toggleFullscreen}>
        <View style={{ flex: 1, backgroundColor: "#000", width: "100%", height: "100%", position: "relative" }}>
          {/* Top Bar with Title & Exit Fullscreen button */}
          <View
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 44 : 20,
              left: 16,
              right: 16,
              zIndex: 999999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Ionicons name="sparkles" size={14} color="#A78BFA" />
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{title || "Yoga Practice"}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={toggleMute}
                style={{
                  backgroundColor: "rgba(0,0,0,0.85)",
                  borderWidth: 1,
                  borderColor: isMuted ? "rgba(245, 158, 11, 0.4)" : "rgba(74, 222, 128, 0.4)",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={16} color={isMuted ? "#F59E0B" : "#4ade80"} />
                <Text style={{ color: isMuted ? "#F59E0B" : "#4ade80", fontSize: 12, fontWeight: "700" }}>
                  {isMuted ? "Unmute" : "Sound On"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleFullscreen}
                style={{
                  backgroundColor: "rgba(0,0,0,0.85)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="contract-outline" size={16} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>Exit Fullscreen</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fullscreen Edge-to-Edge WebView */}
          {WebView ? (
            <WebView
              ref={webViewRef}
              source={{ html: getYouTubeEmbedHtml(videoId), baseUrl: "https://www.youtube.com" }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsInlineMediaPlayback={true}
              allowsFullscreenVideo={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={["*"]}
              mixedContentMode="always"
              onMessage={(event: any) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data && data.type === "YT_STATE_CHANGE") {
                    if (data.state === 1) {
                      setIsPlaying(true);
                      setIsTimerActive(true);
                    } else if (data.state === 2) {
                      setIsPlaying(false);
                      setIsTimerActive(false);
                    }
                  } else if (data && data.type === "YT_ERROR") {
                    console.warn("YouTube IFrame API returned error code:", data.code);
                    setHasError(true);
                  }
                } catch {}
              }}
            />
          ) : null}
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCloseModal}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleCloseModal}>
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

              {/* Live Session Timer Badge (Clickable to Pause/Resume) */}
              <TouchableOpacity
                onPress={toggleTimerPlayPause}
                style={[
                  s.timerBadge,
                  !isPlaying && secondsWatched > 0 && {
                    borderColor: "rgba(245, 158, 11, 0.4)",
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                  },
                ]}
              >
                <Ionicons
                  name={isPlaying ? "stopwatch-outline" : "play-circle-outline"}
                  size={14}
                  color={isPlaying ? A3 : secondsWatched > 0 ? "#F59E0B" : A3}
                />
                <Text style={[s.timerText, !isPlaying && secondsWatched > 0 && { color: "#F59E0B" }]}>
                  {isPlaying
                    ? formatTimer(secondsWatched)
                    : secondsWatched > 0
                    ? `Paused (${formatTimer(secondsWatched)})`
                    : formatTimer(secondsWatched)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCloseModal} style={s.closeBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>

            {modalStep === "player" ? (
              <>
                {/* Embedded Video Player Container */}
                <View style={[s.playerWrapper, isFullscreen && s.fullscreenPlayerWrapper]}>
                  {isFullscreen && (
                    <TouchableOpacity
                      onPress={toggleFullscreen}
                      style={s.fullscreenExitOverlayBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="contract-outline" size={16} color="#FFF" />
                      <Text style={s.fullscreenExitOverlayText}>Exit Fullscreen</Text>
                    </TouchableOpacity>
                  )}
                  {hasError ? (
                    <View style={s.fallbackContainer}>
                      <Ionicons name="logo-youtube" size={44} color="#FF0000" />
                      <Text style={s.fallbackText}>Playback Restricted on Iframe</Text>
                      <Text style={{ fontSize: 11, color: TM, textAlign: "center", marginBottom: 8, paddingHorizontal: 12 }}>
                        YouTube enforces playback restrictions for this video (Error 152/150). Watch seamlessly via:
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={handleInAppBrowser} style={[s.playBtn, { backgroundColor: "#8B5CF6" }]}>
                          <Ionicons name="globe-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={s.playBtnText}>In-App Browser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleExternalOpen} style={s.playBtn}>
                          <Ionicons name="logo-youtube" size={14} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={s.playBtnText}>YouTube App</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : Platform.OS === "web" ? (
                    <iframe
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; background-color: #0B0D14; }
                            html, body { width: 100%; height: 100%; overflow: hidden; background: #0B0D14; display: flex; align-items: center; justify-content: center; }
                            #player { width: 100%; height: 100%; border: none; border-radius: 12px; }
                          </style>
                        </head>
                        <body>
                          <div id="player"></div>
                          <script>
                            var tag = document.createElement('script');
                            tag.src = "https://www.youtube.com/iframe_api";
                            var firstScriptTag = document.getElementsByTagName('script')[0];
                            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                            var player;
                            function onYouTubeIframeAPIReady() {
                              player = new YT.Player('player', {
                                height: '100%',
                                width: '100%',
                                videoId: '${videoId}',
                                host: 'https://www.youtube.com',
                                playerVars: {
                                  'autoplay': 1,
                                  'playsinline': 1,
                                  'enablejsapi': 1,
                                  'rel': 0,
                                  'modestbranding': 1,
                                  'controls': 1
                                },
                                events: {
                                  'onReady': function(e) { try { e.target.playVideo(); } catch(err){} },
                                  'onStateChange': function(e) {
                                    try {
                                      window.parent.postMessage(JSON.stringify({ type: 'YT_STATE_CHANGE', state: e.data }), '*');
                                    } catch(err){}
                                  }
                                }
                              });
                            }
                          </script>
                        </body>
                        </html>
                      `}
                      title={title || "Yoga Video"}
                      style={{ width: "100%", height: "100%", border: 0, borderRadius: 12 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : WebView && !hasError ? (
                    <WebView
                      ref={webViewRef}
                      source={
                        playerMode === "focus"
                          ? { html: getYouTubeEmbedHtml(videoId), baseUrl: "https://www.youtube.com" }
                          : { uri: `https://m.youtube.com/watch?v=${videoId}` }
                      }
                      userAgent={
                        playerMode === "youtube_web"
                          ? "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                          : undefined
                      }
                      style={{ flex: 1, borderRadius: 12, backgroundColor: BG }}
                      allowsInlineMediaPlayback={true}
                      allowsFullscreenVideo={true}
                      mediaPlaybackRequiresUserAction={false}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      androidLayerType="hardware"
                      originWhitelist={["*"]}
                      mixedContentMode="always"
                      startInLoadingState={true}
                      pointerEvents="auto"
                      onMessage={handleWebViewMessage}
                      onError={() => {
                        console.warn("WebView error loading player");
                        setHasError(true);
                      }}
                      renderLoading={() => (
                        <View style={s.loadingContainer}>
                          <ActivityIndicator size="small" color={A3} />
                        </View>
                      )}
                    />
                  ) : (
                    <View style={s.fallbackContainer}>
                      <Ionicons name="logo-youtube" size={44} color="#FF0000" />
                      <Text style={s.fallbackText}>Video Player Ready</Text>
                      <TouchableOpacity onPress={handleInAppBrowser} style={[s.playBtn, { backgroundColor: "#8B5CF6" }]}>
                        <Text style={s.playBtnText}>Open Full Player in App</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Player Mode Switcher Tabs */}
                <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => setPlayerMode("focus")}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      alignItems: "center",
                      borderRadius: 8,
                      backgroundColor: playerMode === "focus" ? A3 : "transparent",
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: playerMode === "focus" ? "#FFF" : TM }}>
                      🎬 Focus Player Controls
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPlayerMode("youtube_web")}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      alignItems: "center",
                      borderRadius: 8,
                      backgroundColor: playerMode === "youtube_web" ? "#FF0000" : "transparent",
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: playerMode === "youtube_web" ? "#FFF" : TM }}>
                      🌐 YouTube Web Page
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Focus Controls Bar: Play/Pause, Seek, Speed, Mute, Fullscreen */}
                {playerMode === "focus" && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 10 }}>
                    {/* Time Progress Display */}
                    {duration > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>
                          {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, "0")} / {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}
                        </Text>
                        <Text style={{ fontSize: 11, color: TM }}>
                          {playbackRate !== 1.0 ? `${playbackRate}x Speed` : "Normal Speed"}
                        </Text>
                      </View>
                    )}

                    {/* Primary Controls Row */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around" }}>
                      {/* Rewind 10s */}
                      <TouchableOpacity onPress={() => seekRelative(-10)} style={s.ctrlIconBtn} activeOpacity={0.7}>
                        <Ionicons name="refresh-outline" size={18} color="#A78BFA" />
                        <Text style={s.ctrlIconBtnText}>-10s</Text>
                      </TouchableOpacity>

                      {/* Play / Pause Toggle */}
                      <TouchableOpacity onPress={togglePlayPausePlayer} style={[s.ctrlIconBtn, { backgroundColor: A3, paddingHorizontal: 16 }]} activeOpacity={0.8}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#FFF" />
                        <Text style={[s.ctrlIconBtnText, { color: "#FFF", fontWeight: "700" }]}>
                          {isPlaying ? "Pause" : "Play"}
                        </Text>
                      </TouchableOpacity>

                      {/* Forward 10s */}
                      <TouchableOpacity onPress={() => seekRelative(10)} style={s.ctrlIconBtn} activeOpacity={0.7}>
                        <Ionicons name="reload-outline" size={18} color="#A78BFA" />
                        <Text style={s.ctrlIconBtnText}>+10s</Text>
                      </TouchableOpacity>

                      {/* Speed Selector Toggle */}
                      <TouchableOpacity onPress={() => setShowSpeedMenu((prev) => !prev)} style={[s.ctrlIconBtn, playbackRate !== 1.0 && { borderColor: A3 }]} activeOpacity={0.7}>
                        <Ionicons name="speedometer-outline" size={18} color={playbackRate !== 1.0 ? A3 : TM} />
                        <Text style={[s.ctrlIconBtnText, playbackRate !== 1.0 && { color: A3 }]}>
                          {playbackRate}x
                        </Text>
                      </TouchableOpacity>

                      {/* Sound Toggle */}
                      <TouchableOpacity onPress={toggleMute} style={s.ctrlIconBtn} activeOpacity={0.7}>
                        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color={isMuted ? "#F59E0B" : "#4ade80"} />
                        <Text style={[s.ctrlIconBtnText, { color: isMuted ? "#F59E0B" : "#4ade80" }]}>
                          {isMuted ? "Muted" : "Audio"}
                        </Text>
                      </TouchableOpacity>

                      {/* Fullscreen & Rotate */}
                      <TouchableOpacity onPress={toggleFullscreen} style={s.ctrlIconBtn} activeOpacity={0.7}>
                        <Ionicons name="expand" size={18} color="#A78BFA" />
                        <Text style={[s.ctrlIconBtnText, { color: "#A78BFA" }]}>Rotate</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Speed Selector Popup Menu */}
                    {showSpeedMenu && (
                      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
                        {SPEED_OPTIONS.map((rate) => (
                          <TouchableOpacity
                            key={rate}
                            onPress={() => setSpeed(rate)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: playbackRate === rate ? A3 : "rgba(255,255,255,0.08)",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: playbackRate === rate ? "#FFF" : TM }}>
                              {rate}x
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

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
                    <Ionicons name="logo-youtube" size={14} color="#FF0000" />
                    <Text style={[s.externalBtnText, { color: A3 }]}>YouTube App</Text>
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
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={s.summaryTitle}>SESSION COMPLETED</Text>
                  </View>
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
    padding: 16,
    gap: 12,
    maxHeight: "94%",
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
    height: 240,
    minHeight: 220,
    backgroundColor: BG,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BD,
  },
  fullscreenPlayerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    borderRadius: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  fullscreenExitOverlayBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 100000,
    elevation: 100000,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fullscreenExitOverlayText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 12,
  },
  fallbackText: {
    fontSize: 13,
    color: TM,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FF0000",
    borderRadius: 8,
  },
  playBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 12,
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
    gap: 10,
    paddingTop: 4,
  },
  externalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  externalBtnText: {
    fontSize: 12,
    color: A3,
    fontWeight: "600",
  },
  ctrlRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  ctrlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: BD,
  },
  ctrlBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  ctrlBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ctrlIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    minWidth: 44,
  },
  ctrlIconBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: TM,
    marginTop: 2,
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
