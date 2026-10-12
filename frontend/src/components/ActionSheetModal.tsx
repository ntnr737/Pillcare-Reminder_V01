import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";

export interface ActionOption {
  icon: string;
  title: string;
  body: string;
  fn: () => void;
}

interface ActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  options: ActionOption[];
  title?: string;
}

export function ActionSheetModal({ visible, onClose, options, title }: ActionSheetModalProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const displayTitle = title || t("actionSheet.title", "What would you like to do?");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheetBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={[s.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
          <View style={s.headerRow}>
            <Text style={[s.title, { color: theme.textPrimary }]}>{displayTitle}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {options.map((o) => (
            <TouchableOpacity
              key={o.title}
              style={[s.optCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderColor: theme.surfaceBorder }]}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  o.fn();
                }, 120);
              }}
            >
              <View style={[s.iconWrap, { backgroundColor: theme.accentBg }]}>
                <Ionicons name={o.icon as any} size={17} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.optTitle, { color: theme.textPrimary }]}>{o.title}</Text>
                <Text style={[s.optBody, { color: theme.textSecondary }]}>{o.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetBox: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    gap: 12,
    zIndex: 10,
    elevation: 10,
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  optCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  optBody: {
    fontSize: 10,
    marginTop: 1,
  },
});
