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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { getSeenNotifIds, markNotifSeen } from "../lib/store";
import { sendSystemNotificationBarAlert } from "../lib/notifications";

export interface InAppNotificationPayload {
  id?: string;
  title: string;
  body?: string;
  message?: string;
  description?: string;
  content?: string;
  type?: string;
  link_url?: string;
  data?: any;
}

export function getInAppBody(n: any): string {
  if (!n) return "";
  const txt = n.body || n.message || n.description || n.content || n.text || n.details;
  if (typeof txt === "string" && txt.trim().length > 0) {
    return txt.trim();
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
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchActiveAnnouncements();
    const interval = setInterval(fetchActiveAnnouncements, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAnnouncements = async () => {
    try {
      const data = await api.getActiveAnnouncements();
      if (Array.isArray(data) && data.length > 0) {
        const seenIds = await getSeenNotifIds();
        const unseen = data.filter((item) => item.id && !seenIds.includes(item.id));
        if (unseen.length > 0) {
          const newest = unseen[0];
          const notifId = newest.id;
          const titleText = newest.title || "PillCare Notification";
          const bodyText = getInAppBody(newest) || "New update received from PillCare.";

          setServerNotif({
            id: notifId,
            title: titleText,
            body: bodyText,
            type: newest.type || "offer",
            link_url: newest.link_url,
          });

          // Dispatch live OS status bar push notification alert
          if (notifId && !notifiedIdsRef.current.has(notifId)) {
            notifiedIdsRef.current.add(notifId);
            sendSystemNotificationBarAlert(titleText, bodyText, { id: notifId, link_url: newest.link_url }).catch(() => {});
          }
        } else {
          setServerNotif(null);
        }
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
  const bodyText = getInAppBody(activeNotif);

  const getTheme = () => {
    switch (notifType) {
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
            bottom: Math.max(insets.bottom + 65, 80),
            transform: [{ translateY }],
            opacity,
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => setDetailModalOpen(true)}>
          <View style={s.topRow}>
            <View style={[s.iconBox, { backgroundColor: `${theme.accent}20` }]}>
              <Ionicons name={theme.icon as any} size={20} color={theme.accent} />
            </View>

            <View style={s.textWrapper}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <View style={[s.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
                  <Text style={[s.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
                </View>
                <Text style={s.tapHint}>Tap to view full text 🔍</Text>
              </View>
              <Text style={s.title} numberOfLines={1}>
                {activeNotif.title}
              </Text>
              <Text style={s.body} numberOfLines={2}>
                {bodyText || "Tap to view full notification details"}
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
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setDetailModalOpen(false)}>
          <SafeAreaView style={s.modalSafe} edges={["bottom"]}>
            <TouchableOpacity activeOpacity={1} style={[s.modalCard, { backgroundColor: "#161926", borderColor: theme.border }]}>
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

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalBodyContent}>
                <Text style={s.modalFullTitle}>{activeNotif.title}</Text>
                <Text style={s.modalFullBody}>
                  {bodyText || "No additional description provided for this notification."}
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
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
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
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    maxHeight: "80%",
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
