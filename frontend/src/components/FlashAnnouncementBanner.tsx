import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";

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
  const [announcements, setAnnouncements] = useState<FlashAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await api.getActiveAnnouncements();
      if (Array.isArray(data)) {
        setAnnouncements(data);
      }
    } catch (err) {
      // Quiet fail if network unavailable
    }
  };

  const visibleAnnouncements = announcements.filter(
    (item) => !dismissedIds.includes(item.id)
  );

  if (visibleAnnouncements.length === 0) return null;

  const current = visibleAnnouncements[currentIndex % visibleAnnouncements.length];

  const handleDismiss = () => {
    setDismissedIds((prev) => [...prev, current.id]);
  };

  const handlePressAction = () => {
    if (current.link_url) {
      Linking.openURL(current.link_url).catch(() => {});
    }
  };

  const getTypeTheme = (type: string) => {
    switch (type) {
      case "offer":
        return {
          bg: "#4F46E5",
          border: "#6366F1",
          icon: "gift-outline" as const,
          iconColor: "#FDE047",
        };
      case "warning":
        return {
          bg: "#D97706",
          border: "#F59E0B",
          icon: "warning-outline" as const,
          iconColor: "#FFF",
        };
      case "alert":
        return {
          bg: "#DC2626",
          border: "#EF4444",
          icon: "alert-circle-outline" as const,
          iconColor: "#FFF",
        };
      default:
        return {
          bg: "#0284C7",
          border: "#38BDF8",
          icon: "megaphone-outline" as const,
          iconColor: "#E0F2FE",
        };
    }
  };

  const theme = getTypeTheme(current.type);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={styles.contentRow}>
        <View style={styles.iconBadge}>
          <Ionicons name={theme.icon} size={20} color={theme.iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {current.body}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {current.link_url ? (
        <TouchableOpacity style={styles.actionRow} onPress={handlePressAction}>
          <Text style={styles.actionText}>Tap to learn more</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  body: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.95)",
    marginTop: 2,
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 4,
  },
});
