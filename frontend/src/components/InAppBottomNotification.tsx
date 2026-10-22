import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  Image,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { get, K, getSeenNotifIds, markNotifSeen, getAppInstallTimestamp } from "../lib/store";

export interface InAppNotificationPayload {
  id?: string;
  title: string;
  body?: string;
  message?: string;
  description?: string;
  content?: string;
  type?: string;
  link_url?: string;
  image_url?: string;
  data?: any;
}

const GENERIC_NAMES = new Set([
  "pillcare", "pillcare user", "pillcare guest", "guest", "you",
  "user", "anonymous", "friend", "none", "null", "test", "tester",
  "pill care", "pill care user", "pill care guest"
]);

export function interpolateNotificationTags(text: string, profile?: any, streakVal?: any): string {
  if (!text) return "";
  let rawName = (profile?.nickname || profile?.name || "").trim();
  if (GENERIC_NAMES.has(rawName.toLowerCase())) {
    rawName = "";
  }
  const firstName = rawName ? rawName.split(" ")[0].trim() : "Friend";
  const fullName = rawName || "Friend";
  const streak = typeof streakVal === "number" ? streakVal : (streakVal?.current ?? streakVal?.streak ?? 0);
  const city = profile?.city || profile?.location_city || "";
  const country = profile?.country || profile?.location_country || "";

  return text
    .replace(/\{\{?\s*(?:first_name|first\s*name|firstname)\s*\}?\}/gi, firstName)
    .replace(/\{\{?\s*(?:full_name|full\s*name|fullname|name)\s*\}?\}/gi, fullName)
    .replace(/\{\{?\s*(?:streak_days|streak\s*days|streakdays|streak)\s*\}?\}/gi, String(streak))
    .replace(/\{\{?\s*(?:city|location_city)\s*\}?\}/gi, city)
    .replace(/\{\{?\s*(?:country|location_country)\s*\}?\}/gi, country)
    .replace(/\{\{?\s*(?:app_name|app\s*name|appname|app)\s*\}?\}/gi, "PillCare");
}

export function getInAppBody(n: any): string {
  if (!n) return "";
  const direct =
    n.body ||
    n.message ||
    n.description ||
    n.content ||
    n.text ||
    n.details ||
    n.subtitle ||
    n.summary;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  if (n.data && typeof n.data === "object") {
    const nested =
      n.data.body ||
      n.data.message ||
      n.data.description ||
      n.data.content ||
      n.data.text ||
      n.data.details ||
      n.data.summary;
    if (typeof nested === "string" && nested.trim().length > 0) {
      return nested.trim();
    }
  }

  return "";
}

interface InAppBottomNotificationProps {
  notification?: InAppNotificationPayload | null;
  onDismiss?: () => void;
  onPressAction?: () => void;
}

export function InAppBottomNotification({
  notification,
  onDismiss,
  onPressAction,
}: InAppBottomNotificationProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [serverNotif, setServerNotif] = useState<InAppNotificationPayload | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStreak, setUserStreak] = useState<any>(0);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function loadUserData() {
      try {
        const [prof, strk] = await Promise.all([
          get<any>(K.profile),
          get<any>(K.streak),
        ]);
        if (prof) setUserProfile(prof);
        if (strk !== undefined && strk !== null) setUserStreak(strk);
      } catch {}
    }
    loadUserData();
    fetchActiveAnnouncements();
    // Poll every 5 minutes instead of 10s to conserve server requests and battery
    const interval = setInterval(fetchActiveAnnouncements, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAnnouncements = async () => {
    try {
      const storedProfile = await get<any>(K.profile);
      const userCountry = storedProfile?.country_code || storedProfile?.country || storedProfile?.location_country || undefined;
      const data = await api.getActiveAnnouncements("free", userCountry);
      if (Array.isArray(data) && data.length > 0) {
        const seenIds = await getSeenNotifIds();
        const installTs = await getAppInstallTimestamp();
        const now = Date.now();

        // Notification Lifecycle Rules:
        // 1. Announcements created before app was installed (beyond 5m grace) are auto-marked seen so new users are never spammed with historic alerts
        // 2. Flash alerts (⚡) have a strict 4-hour lifespan; stale flash alerts are auto-marked seen
        let unreadItem: any = null;

        for (const item of data) {
          if (!item || !item.id || seenIds.includes(item.id)) continue;

          const createdTs = item.created_at ? new Date(item.created_at).getTime() : now;

          // If created before user installed the app, mark as seen and skip
          if (createdTs < installTs - 5 * 60 * 1000) {
            markNotifSeen(item.id).catch(() => {});
            continue;
          }

          // If flash alert is older than 4 hours, mark as expired/seen and skip
          if (item.type === "flash" && now - createdTs > 4 * 3600 * 1000) {
            markNotifSeen(item.id).catch(() => {});
            continue;
          }

          unreadItem = item;
          break;
        }

        if (!unreadItem || !unreadItem.id) {
          setServerNotif(null);
          return;
        }

        const notifId = unreadItem.id;
        const titleText = unreadItem.title || "PillCare Notification";
        const bodyText = getInAppBody(unreadItem) || "New update received from PillCare.";
        const imageUrl = unreadItem.image_url || unreadItem.image || unreadItem.img || unreadItem.banner_url || unreadItem.data?.image_url;

        setServerNotif({
          id: notifId,
          title: titleText,
          body: bodyText,
          type: unreadItem.type || "offer",
          link_url: unreadItem.link_url,
          image_url: imageUrl,
        });
      } else {
        setServerNotif(null);
      }
    } catch {}
  };

  const activeNotif = notification || serverNotif;

  useEffect(() => {
    if (activeNotif) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(200);
      opacity.setValue(0);
      setDetailModalOpen(false);
    }
  }, [activeNotif]);

  // Flash auto-dismiss timer (15s), paused if detail modal is open
  useEffect(() => {
    if (activeNotif?.type === "flash" && !detailModalOpen) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [activeNotif, detailModalOpen]);

  const handleDismiss = async () => {
    setDetailModalOpen(false);
    if (activeNotif?.id) {
      await markNotifSeen(activeNotif.id);
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 200,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (notification && onDismiss) {
        onDismiss();
      }
      setServerNotif(null);
    });
  };

  if (!activeNotif) return null;

  const notifType = activeNotif.type || "info";
  const rawBodyText = getInAppBody(activeNotif);
  const renderedTitle = interpolateNotificationTags(activeNotif.title, userProfile, userStreak);
  const renderedBody = interpolateNotificationTags(rawBodyText, userProfile, userStreak);

  const getTheme = () => {
    switch (notifType) {
      case "flash":
        return { bg: "#221338", border: "#f59e0b", icon: "flash", accent: "#fbbf24", badge: "⚡ FLASH ALERT", btnBg: "#f59e0b" };
      case "offer":
        return { bg: "#1e1b4b", border: "#6366f1", icon: "gift-outline", accent: "#a78bfa", badge: "SPECIAL OFFER", btnBg: "#6366f1" };
      case "warning":
        return { bg: "#451a03", border: "#f59e0b", icon: "warning-outline", accent: "#fbbf24", badge: "WARNING", btnBg: "#d97706" };
      case "alert":
        return { bg: "#450a0a", border: "#ef4444", icon: "alert-circle-outline", accent: "#f87171", badge: "ALERT", btnBg: "#dc2626" };
      case "medication":
        return { bg: "#064e3b", border: "#10b981", icon: "medical-outline", accent: "#34d399", badge: "MEDICATION", btnBg: "#10b981" };
      default:
        return { bg: "#161926", border: "#9184d9", icon: "notifications-outline", accent: "#a78bfa", badge: "NOTIFICATION", btnBg: "#8b5cf6" };
    }
  };

  const theme = getTheme();

  const handleActionClick = async () => {
    setDetailModalOpen(false);
    if (activeNotif?.id) {
      await markNotifSeen(activeNotif.id);
    }
    if (onPressAction) {
      onPressAction();
    } else if (activeNotif.link_url) {
      Linking.openURL(activeNotif.link_url).catch(() => {});
    }
    handleDismiss();
  };

  return (
    <>
      {/* Floating Bottom Notification Banner (Single Instance) */}
      <Animated.View
        style={[
          s.floatingContainer,
          {
            bottom: Math.max(insets.bottom + 85, 95),
            transform: [{ translateY }],
            opacity,
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => setDetailModalOpen(true)}>
          <View style={s.topRow}>
            {activeNotif.image_url ? (
              <Image
                source={{ uri: activeNotif.image_url }}
                style={s.thumbnailImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.iconBox, { backgroundColor: `${theme.accent}20` }]}>
                <Ionicons name={theme.icon as any} size={20} color={theme.accent} />
              </View>
            )}

            <View style={s.textWrapper}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                <View style={[s.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
                  <Text style={[s.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
                </View>
              </View>
              <Text style={s.title} numberOfLines={2}>
                {renderedTitle}
              </Text>
              <Text style={s.body} numberOfLines={4}>
                {renderedBody || "Tap to view full notification details"}
              </Text>
            </View>

            {/* Cancel / Close Button on the Right */}
            <TouchableOpacity
              style={s.cancelButton}
              onPress={handleDismiss}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={24} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Full Detail Modal when clicked */}
      <Modal
        visible={detailModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setDetailModalOpen(false)}>
          <SafeAreaView style={s.modalSafe} edges={["bottom"]}>
            <Pressable onPress={(e) => e.stopPropagation()} style={[s.modalCard, { backgroundColor: "#161926", borderColor: theme.border }]}>
              <View style={s.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <View style={[s.iconBox, { backgroundColor: `${theme.accent}20` }]}>
                    <Ionicons name={theme.icon as any} size={20} color={theme.accent} />
                  </View>
                  <View style={[s.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
                    <Text style={[s.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleDismiss} style={s.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.modalBodyContent}
                style={{ maxHeight: 380 }}
              >
                {activeNotif.image_url ? (
                  <View style={s.modalBannerWrapper}>
                    <Image
                      source={{ uri: activeNotif.image_url }}
                      style={s.modalBannerImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
                <Text style={s.modalFullTitle}>{renderedTitle}</Text>
                <Text style={s.modalFullBody}>
                  {renderedBody || "No additional description provided for this notification."}
                </Text>
              </ScrollView>

              <View style={s.modalFooter}>
                {(activeNotif.link_url || onPressAction) ? (
                  <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.btnBg }]} onPress={handleActionClick} activeOpacity={0.8}>
                    <Text style={s.primaryBtnText}>View & Take Action</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={s.secondaryBtn} onPress={handleDismiss} activeOpacity={0.7}>
                  <Text style={s.secondaryBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 13,
    zIndex: 9999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "#1e293b",
  },
  modalBannerWrapper: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#1e293b",
  },
  modalBannerImage: {
    width: "100%",
    height: "100%",
  },
  textWrapper: {
    flex: 1,
  },
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tapHint: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.55)",
    fontWeight: "600",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  body: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
    lineHeight: 16,
  },
  cancelButton: {
    padding: 2,
    alignSelf: "flex-start",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalSafe: {
    width: "100%",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBodyContent: {
    gap: 10,
    paddingVertical: 6,
  },
  modalFullTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 24,
  },
  modalFullBody: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 21,
  },
  modalFooter: {
    gap: 8,
    marginTop: 6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
});
