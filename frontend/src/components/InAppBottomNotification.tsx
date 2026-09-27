import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface InAppNotificationPayload {
  id?: string;
  title: string;
  body: string;
  type?: string;
  link_url?: string;
  data?: any;
}

interface InAppBottomNotificationProps {
  notification: InAppNotificationPayload | null;
  onDismiss: () => void;
  onPressAction?: () => void;
}

const { width } = Dimensions.get("window");

export function InAppBottomNotification({
  notification,
  onDismiss,
  onPressAction,
}: InAppBottomNotificationProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(180)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      // Slide up from bottom
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

      // Auto dismiss after 8 seconds if user doesn't tap
      const timer = setTimeout(() => {
        handleDismiss();
      }, 8000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(180);
      opacity.setValue(0);
    }
  }, [notification]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 180,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!notification) return null;

  const notifType = notification.type || "info";
  const getTheme = () => {
    switch (notifType) {
      case "offer":
        return { bg: "#1e1b4b", border: "#6366f1", icon: "gift-outline", accent: "#a78bfa", badge: "SPECIAL OFFER" };
      case "warning":
        return { bg: "#451a03", border: "#f59e0b", icon: "warning-outline", accent: "#fbbf24", badge: "WARNING" };
      case "alert":
        return { bg: "#450a0a", border: "#ef4444", icon: "alert-circle-outline", accent: "#f87171", badge: "ALERT" };
      case "medication":
        return { bg: "#064e3b", border: "#10b981", icon: "medical-outline", accent: "#34d399", badge: "MEDICATION" };
      default:
        return { bg: "#161926", border: "#9184d9", icon: "notifications-outline", accent: "#a78bfa", badge: "NOTIFICATION" };
    }
  };

  const theme = getTheme();

  const handlePress = () => {
    if (onPressAction) {
      onPressAction();
    } else if (notification.link_url) {
      Linking.openURL(notification.link_url).catch(() => {});
    }
    handleDismiss();
  };

  return (
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
      <View style={s.topRow}>
        <View style={[s.iconBox, { backgroundColor: `${theme.accent}20` }]}>
          <Ionicons name={theme.icon as any} size={20} color={theme.accent} />
        </View>

        <View style={s.textWrapper}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <View style={[s.badgeTag, { backgroundColor: `${theme.accent}25` }]}>
              <Text style={[s.badgeText, { color: theme.accent }]}>{theme.badge}</Text>
            </View>
            <Text style={s.timeText}>Just now</Text>
          </View>
          <Text style={s.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={s.body} numberOfLines={2}>
            {notification.body}
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

      {/* Action Footer (if link or action provided) */}
      {(notification.link_url || onPressAction) && (
        <TouchableOpacity style={s.actionFooter} onPress={handlePress} activeOpacity={0.8}>
          <Text style={[s.actionBtnText, { color: theme.accent }]}>View Details & Open</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.accent} />
        </TouchableOpacity>
      )}
    </Animated.View>
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
  timeText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.45)",
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
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
