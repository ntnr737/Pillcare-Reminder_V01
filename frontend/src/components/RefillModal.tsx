import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { api } from "@/src/lib/api";

type Props = {
  visible: boolean;
  medication: { id: string; name: string; stock?: number } | null;
  onClose: () => void;
  onRefilled: (medId: string, addStock: number, newStock: number) => void;
};

const PRESET_STRIPS = [10, 15, 25, 30];

export function RefillModal({ visible, medication, onClose, onRefilled }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [selectedQty, setSelectedQty] = useState<number>(10);
  const [customQty, setCustomQty] = useState<string>("10");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedQty(10);
      setCustomQty("10");
      setLoading(false);
    }
  }, [visible]);

  const handleSelectPreset = (qty: number) => {
    setSelectedQty(qty);
    setCustomQty(String(qty));
  };

  const handleCustomChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setCustomQty(cleaned);
    const val = parseInt(cleaned) || 0;
    setSelectedQty(val);
  };

  const handleConfirmRefill = async () => {
    if (!medication) return;
    const addQty = parseInt(customQty) || 0;
    if (addQty <= 0) {
      Alert.alert(t("refill.invalidQty", "Invalid Quantity"), t("refill.invalidQtyDesc", "Please enter a valid refill quantity (at least 1 pill)."));
      return;
    }

    setLoading(true);
    try {
      const res = await api.refillMedication(medication.id, addQty);
      const currentStock = medication.stock ?? 0;
      const newStock = res?.stock ?? (currentStock + addQty);
      Alert.alert(t("refill.successTitle", "Stock Refilled"), `Added +${addQty} pills to ${medication.name}.\nNew total stock: ${newStock} pills.`);
      onRefilled(medication.id, addQty, newStock);
      onClose();
    } catch (err: any) {
      Alert.alert(t("refill.failedTitle", "Refill Failed"), err?.message || t("refill.failedDesc", "Failed to refill stock. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEPharmacy = (provider: string, url: string) => {
    // Security Vector: Deep Link & Scheme Validation (anti open-redirect / intent hijacking)
    try {
      if (!url.startsWith("https://")) {
        Alert.alert("Security Notice", "Insecure or invalid URL scheme detected.");
        return;
      }
      const allowedHosts = [
        "www.1mg.com", "1mg.com",
        "www.apollo247.com", "apollo247.com",
        "www.pharmeasy.in", "pharmeasy.in",
        "www.amazon.com", "amazon.com",
        "www.amazon.in", "amazon.in"
      ];
      // URL parsing validation
      const match = url.match(/^https:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
      const host = match ? match[1].toLowerCase() : "";
      if (!allowedHosts.includes(host)) {
        Alert.alert("Security Notice", "Untrusted pharmacy provider domain blocked.");
        return;
      }
    } catch {
      Alert.alert("Security Notice", "Malformed URL encountered.");
      return;
    }

    try {
      api.trackEvent("refill_epharmacy_click", { provider, medication: medication?.name });
    } catch {}
    Linking.openURL(url).catch(() => {
      Alert.alert("Notice", `Could not open ${provider}. Please check your browser or internet connection.`);
    });
  };

  if (!medication) return null;

  const currentStock = medication.stock ?? 0;
  const newTotal = currentStock + (parseInt(customQty) || 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.content, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
          
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{t("refill.title", "Refill Medication Stock")}</Text>
              <Text style={[styles.subtitle, { color: theme.accent }]}>{medication.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current Stock Banner */}
          <View style={[styles.stockCard, { backgroundColor: theme.accentBg, borderColor: theme.accent }]}>
            <Ionicons name="cube-outline" size={20} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stockLabel, { color: theme.textSecondary }]}>{t("refill.currentStock", "Current Stock")}</Text>
              <Text style={[styles.stockValue, { color: theme.textPrimary }]}>{currentStock} {t("refill.pillsRemaining", "pills remaining")}</Text>
            </View>
          </View>

          {/* Online E-Pharmacy 1-Tap Ordering Hub */}
          <View style={[styles.onlineRefillCard, { backgroundColor: isDark ? "rgba(145,132,217,0.08)" : "rgba(145,132,217,0.05)", borderColor: theme.surfaceBorder }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="cart" size={15} color={theme.accent} />
                <Text style={[styles.onlineRefillTitle, { color: theme.textPrimary }]}>Order Refill Online</Text>
              </View>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>Up to 20% OFF</Text>
              </View>
            </View>
            <Text style={[styles.onlineRefillSub, { color: theme.textSecondary }]}>
              Tap to order {medication.name} with fast doorstep delivery:
            </Text>
            <View style={styles.pharmacyBtnRow}>
              <TouchableOpacity
                style={[styles.pharmacyBtn, { backgroundColor: "#FF6F61" }]}
                activeOpacity={0.8}
                onPress={() => handleOpenEPharmacy("Tata 1mg", `https://www.1mg.com/search/all?name=${encodeURIComponent(medication.name)}&utm_source=pillcare&utm_medium=affiliate`)}
              >
                <Text style={styles.pharmacyBtnText}>Tata 1mg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pharmacyBtn, { backgroundColor: "#0284C7" }]}
                activeOpacity={0.8}
                onPress={() => handleOpenEPharmacy("Apollo 24|7", `https://www.apollo247.com/search-medicines/${encodeURIComponent(medication.name)}?utm_source=pillcare`)}
              >
                <Text style={styles.pharmacyBtnText}>Apollo 24|7</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pharmacyBtn, { backgroundColor: "#10B981" }]}
                activeOpacity={0.8}
                onPress={() => handleOpenEPharmacy("PharmEasy", `https://pharmeasy.in/search/all?name=${encodeURIComponent(medication.name)}&utm_source=pillcare`)}
              >
                <Text style={styles.pharmacyBtnText}>PharmEasy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pharmacyBtn, { backgroundColor: "#D97706" }]}
                activeOpacity={0.8}
                onPress={() => handleOpenEPharmacy("Amazon Pharmacy", `https://www.amazon.com/s?k=${encodeURIComponent(medication.name)}+medication&tag=pillcare-20`)}
              >
                <Text style={styles.pharmacyBtnText}>Amazon</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t("refill.selectPreset", "Or Record Stock Delivered Manually:")}</Text>

          {/* Preset Buttons */}
          <View style={styles.presetsRow}>
            {PRESET_STRIPS.map((qty) => {
              const isSelected = selectedQty === qty && customQty === String(qty);
              return (
                <TouchableOpacity
                  key={qty}
                  onPress={() => handleSelectPreset(qty)}
                  style={[
                    styles.presetChip,
                    { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder },
                    isSelected && { backgroundColor: theme.accentBg, borderColor: theme.accent },
                  ]}
                >
                  <Text style={[styles.presetText, { color: theme.textPrimary }, isSelected && { color: theme.accent }]}>
                    +{qty} pills
                  </Text>
                  <Text style={[styles.presetSub, { color: theme.textSecondary }, isSelected && { color: theme.accent }]}>
                    {qty === 10 ? "1 Strip (10)" : `${qty} Pack`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Input Field */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("refill.customQty", "Custom Refill Quantity")}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#1e2030" : "#f8fafc", borderColor: theme.surfaceBorder }]}>
              <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                value={customQty}
                onChangeText={handleCustomChange}
                keyboardType="number-pad"
                placeholder={t("refill.enterQty", "Enter quantity")}
                placeholderTextColor={theme.textDisabled}
              />
              <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "600" }}>pills</Text>
            </View>
          </View>

          {/* Calculated Total Preview */}
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>{t("refill.newTotal", "New Total Stock After Refill:")}</Text>
            <Text style={[styles.previewValue, { color: theme.accent }]}>{newTotal} pills</Text>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.accent }, loading && { opacity: 0.7 }]}
            onPress={handleConfirmRefill}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={styles.confirmBtnText}>{t("refill.confirm", `Add +${customQty || "0"} Pills to Stock`)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  stockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  stockLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  stockValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  presetText: {
    fontSize: 13,
    fontWeight: "700",
  },
  presetSub: {
    fontSize: 10,
    marginTop: 2,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  confirmBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  onlineRefillCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  onlineRefillTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  discountBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
  },
  onlineRefillSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  pharmacyBtnRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  pharmacyBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pharmacyBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});
