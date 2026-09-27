import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { getSeenNotifIds, markNotifSeen } from "../lib/store";

interface FlashAnnouncement {
  id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "offer" | "alert";
  target_plan: string;
  link_url?: string;
  expires_at?: string;
  created_at: string;
}

export function FlashAnnouncementBanner() {
  const insets = useSafeAreaInsets();
  const [activeAnnouncement, setActiveAnnouncement] = useState<FlashAnnouncement | null>(null);
  const [fullDetailOpen, setFullDetailOpen] = useState(false);

  const translateY = useRef(new Animated.Value(180)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAnnouncements();

    // Poll server every 12s for newly pushed admin notifications
    const interval = setInterval(() => {
      fetchAnnouncements();
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await api.getActiveAnnouncements();
      if (Array.isArray(data) && data.length > 0) {
        const seenIds = await getSeenNotifIds();
        // Filter out any notification already permanently seen by this user
        const unseen = data.filter((item) => item.id && !seenIds.includes(item.id));
        if (unseen.length > 0) {
          // Select strictly the newest unseen notification
          const newest = unseen[0];
          setActiveAnnouncement(newest);
          // Slide up animation
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
          setActiveAnnouncement(null);
        }
      } else {
        setActiveAnnouncement(null);
      }
    } catch (err) {
      // Quiet fail if network unavailable
    }
  };

  if (!activeAnnouncement) return null;

  const current = activeAnnouncement;

  const handleDismiss = async () => {
    setFullDetailOpen(false);
    // Mark as permanently seen so it NEVER loops or repeats on app launch
    if (current.id) {
      await markNotifSeen(current.id);
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 180,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveAnnouncement(null);
    });
  };

  const handlePressAction = async () => {
    setFullDetailOpen(false);
    if (current.id) {
      await markNotifSeen(current.id);
    }
    if (current.link_url) {
      Linking.openURL(current.link_url).catch(() => {});
    }
    setActiveAnnouncement(null);
  };

  const getTypeTheme = (type: string) => {
    switch (type) {
      case "offer":
        return {
          bg: "#1e1b4b",
          border: "#6366f1",
          icon: "gift-outline" as const,
          accent: "#a78bfa",
          badge: "SPECIAL OFFER",
          btnBg: "#6366f1",
        };
      case "warning":
        return {
          bg: "#451a03",
          border: "#f59e0b",
          icon: "warning-outline" as const,
          accent: "#fbbf24",
          badge: "WARNING",
          btnBg: "#d97706",
        };
      case "alert":
        return {
          bg: "#450a0a",
          border: "#ef4444",
          icon: "alert-circle-outline" as const,
          accent: "#f87171",
          badge: "ALERT",
          btnBg: "#dc2626",
        };
      default:
        return {
          bg: "#0c4a6e",
          border: "#38bdf8",
          icon: "megaphone-outline" as const,
          accent: "#38bdf8",
          badge: "ANNOUNCEMENT",
          btnBg: "#0284c7",
        };
    }
  };

  const theme = getTypeTheme(current.type);

  return (
    <>
      {/* Bottom Floating Announcement Banner */}
      <Animated.View
        style={[
          styles.bottomFloatingContainer,
          {
            bottom: Math.max(insets.bottom + 65, 80),
            transform: [{ translateY }],
            opacity,
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => setFullDetailOpen(true)}>
          <View style={styles.contentRow}>
            <View style={[styles.iconBadge, { backgroundColor: `${theme.accent}20` }]}>
              <Ionicons name={theme.icon} size={20} color={theme.accent} />
            </View>

            <View style={styles.textContainer}>
              <View style={styles.topBadgeRow}>
                <View style={[styles.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
                  <Text style={[styles.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
                </View>
                <Text style={styles.tapHintText}>Tap to view full text 🔍</Text>
              </View>

              <Text style={styles.title} numberOfLines={1}>
                {current.title}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {current.body}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismiss}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={24} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Full Untruncated Announcement Modal */}
      <Modal
        visible={fullDetailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFullDetailOpen(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFullDetailOpen(false)}>
          <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: "#161926", borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <View style={[styles.iconBadge, { backgroundColor: `${theme.accent}20` }]}>
                    <Ionicons name={theme.icon} size={20} color={theme.accent} />
                  </View>
                  <View style={[styles.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
                    <Text style={[styles.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={handleDismiss} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBodyContent}>
                <Text style={styles.modalFullTitle}>{current.title}</Text>
                <Text style={styles.modalFullBody}>{current.body}</Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                {current.link_url ? (
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.btnBg }]} onPress={handlePressAction} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Upgrade & Learn More</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleDismiss} activeOpacity={0.7}>
                  <Text style={styles.secondaryBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomFloatingContainer: {
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
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  topBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
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
  tapHintText: {
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
  closeButton: {
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
