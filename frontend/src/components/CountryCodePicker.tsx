import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export interface CountryCode {
  code: string;       // e.g. "IN"
  dialCode: string;   // e.g. "+91"
  name: string;       // e.g. "India"
  flag: string;       // e.g. "🇮🇳"
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "IN", dialCode: "+91", name: "India", flag: "🇮🇳" },
  { code: "US", dialCode: "+1", name: "United States / Canada", flag: "🇺🇸" },
  { code: "GB", dialCode: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AE", dialCode: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "AU", dialCode: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "DE", dialCode: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "FR", dialCode: "+33", name: "France", flag: "🇫🇷" },
  { code: "BD", dialCode: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "PK", dialCode: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "SG", dialCode: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "MY", dialCode: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "NP", dialCode: "+977", name: "Nepal", flag: "🇳🇵" },
  { code: "LK", dialCode: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "ZA", dialCode: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", dialCode: "+234", name: "Nigeria", flag: "🇳🇬" },
  { code: "BR", dialCode: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", dialCode: "+52", name: "Mexico", flag: "🇲🇽" },
];

interface CountryCodePickerProps {
  selectedDialCode: string;
  onSelectCountry: (country: CountryCode) => void;
  style?: any;
}

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  selectedDialCode = "+91",
  onSelectCountry,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");

  const currentCountry =
    COUNTRY_CODES.find((c) => c.dialCode === selectedDialCode) || COUNTRY_CODES[0];

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <TouchableOpacity
        style={[
          styles.btn,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            borderColor: theme.surfaceBorder,
          },
          style,
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14 }}>{currentCountry.flag}</Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: theme.textPrimary,
          }}
        >
          {currentCountry.dialCode}
        </Text>
        <Ionicons name="chevron-down" size={12} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* Country Selection Modal */}
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
                  Select Country Code
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                  Choose country prefix for WhatsApp alerts
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: theme.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search country name or code..."
                placeholderTextColor={theme.textSecondary}
                style={{ flex: 1, color: theme.textPrimary, fontSize: 13 }}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              style={{ maxHeight: 340 }}
              contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            >
              {filtered.map((country) => {
                const isSelected = country.dialCode === currentCountry.dialCode;
                return (
                  <TouchableOpacity
                    key={country.code + country.dialCode}
                    style={[
                      styles.countryOption,
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
                      onSelectCountry(country);
                      setModalVisible(false);
                      setSearch("");
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: isSelected ? theme.accent : theme.textPrimary,
                        }}
                      >
                        {country.name}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isSelected ? theme.accent : theme.textSecondary,
                      }}
                    >
                      {country.dialCode}
                    </Text>
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

// Helper utility to combine country code & phone digits into clean WhatsApp format
export function formatFullWhatsAppPhone(countryDialCode: string, inputPhone: string): string {
  if (!inputPhone) return "";
  let digits = inputPhone.replace(/\D/g, "");
  if (!digits) return "";
  
  // If user entered full number starting with country code digits already
  const codeDigits = countryDialCode.replace(/\D/g, "");
  if (digits.startsWith(codeDigits)) {
    return "+" + digits;
  }
  
  // Remove leading 0 if present (e.g. 09876543210 -> +919876543210)
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  
  return countryDialCode + digits;
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  countryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
