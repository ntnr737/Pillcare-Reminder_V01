import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  useTranslation,
  SUPPORTED_LANGUAGES,
  SupportedLocale,
} from "../context/LanguageContext";

import { ThemeToggleSwitch } from "./ThemeToggleSwitch";

interface HeaderControlsProps {
  showLanguagePicker?: boolean;
  showThemeToggle?: boolean;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  showLanguagePicker = true,
  showThemeToggle = true,
}) => {
  const { theme, isDark } = useTheme();
  const { currentLanguage, setLocale, t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <View style={styles.container}>
        {showLanguagePicker && (
          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                borderColor: theme.surfaceBorder,
              },
            ]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="language-outline" size={13} color={theme.accent} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: theme.textPrimary,
                textTransform: "uppercase",
              }}
            >
              {currentLanguage.code}
            </Text>
            <Ionicons name="chevron-down" size={10} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {showThemeToggle && <ThemeToggleSwitch size="sm" />}
      </View>

      {/* Language Selector Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={{ gap: 2 }}>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
                  {t("support.selectLanguage", "Select Language")}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                  Choose your preferred application language
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === currentLanguage.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langOption,
                      {
                        backgroundColor: isSelected
                          ? theme.accentBg
                          : isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isSelected ? theme.accent : theme.surfaceBorder,
                      },
                    ]}
                    onPress={() => {
                      setLocale(lang.code as SupportedLocale);
                      setModalVisible(false);
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isSelected ? theme.accentBg : "rgba(150,150,150,0.1)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="globe-outline" size={16} color={isSelected ? theme.accent : theme.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: isSelected ? theme.accent : theme.textPrimary,
                        }}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                        {lang.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.15)",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(150,150,150,0.1)",
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
