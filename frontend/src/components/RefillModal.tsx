import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";

type Props = {
  visible: boolean;
  medication: { id: string; name: string; stock?: number } | null;
  onClose: () => void;
  onRefilled: (medId: string, addStock: number, newStock: number) => void;
};

const PRESET_STRIPS = [10, 15, 25, 30];

export function RefillModal({ visible, medication, onClose, onRefilled }: Props) {
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
      Alert.alert("Invalid Quantity", "Please enter a valid refill quantity (at least 1 pill).");
      return;
    }

    setLoading(true);
    try {
      const res = await api.refillMedication(medication.id, addQty);
      const currentStock = medication.stock ?? 0;
      const newStock = res?.stock ?? (currentStock + addQty);
      Alert.alert("Stock Refilled", `Added +${addQty} pills to ${medication.name}.\nNew total stock: ${newStock} pills.`);
      onRefilled(medication.id, addQty, newStock);
      onClose();
    } catch (err: any) {
      Alert.alert("Refill Failed", err?.message || "Failed to refill stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!medication) return null;

  const currentStock = medication.stock ?? 0;
  const newTotal = currentStock + (parseInt(customQty) || 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Refill Medication Stock</Text>
              <Text style={styles.subtitle}>{medication.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Current Stock Banner */}
          <View style={styles.stockCard}>
            <Ionicons name="cube-outline" size={20} color="#38bdf8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.stockLabel}>Current Stock</Text>
              <Text style={styles.stockValue}>{currentStock} pills remaining</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Select Strip Size or Enter Quantity:</Text>

          {/* Preset Buttons */}
          <View style={styles.presetsRow}>
            {PRESET_STRIPS.map((qty) => {
              const isSelected = selectedQty === qty && customQty === String(qty);
              return (
                <TouchableOpacity
                  key={qty}
                  onPress={() => handleSelectPreset(qty)}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                >
                  <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                    +{qty} pills
                  </Text>
                  <Text style={[styles.presetSub, isSelected && styles.presetSubActive]}>
                    {qty === 10 ? "1 Strip (10)" : qty === 15 ? "15 Pack" : qty === 25 ? "25 Pack" : "30 Pack"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Input Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Custom Refill Quantity</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="add-circle-outline" size={18} color="#38bdf8" />
              <TextInput
                style={styles.input}
                value={customQty}
                onChangeText={handleCustomChange}
                keyboardType="number-pad"
                placeholder="Enter quantity"
                placeholderTextColor="#64748b"
              />
              <Text style={{ fontSize: 13, color: "#94a3b8", fontWeight: "600" }}>pills</Text>
            </View>
          </View>

          {/* Calculated Total Preview */}
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>New Total Stock After Refill:</Text>
            <Text style={styles.previewValue}>{newTotal} pills</Text>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
            onPress={handleConfirmRefill}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#0f172a" />
                <Text style={styles.confirmBtnText}>Add +{customQty || "0"} Pills to Stock</Text>
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
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  content: {
    backgroundColor: "#1e2230",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 13,
    color: "#38bdf8",
    fontWeight: "600",
    marginTop: 2,
  },
  stockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  stockLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  stockValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginTop: 4,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: "#282d3f",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  presetChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38bdf8",
  },
  presetText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  presetTextActive: {
    color: "#38bdf8",
  },
  presetSub: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  presetSubActive: {
    color: "#7dd3fc",
  },
  inputContainer: {
    gap: 6,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#282d3f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
    padding: 0,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 12,
    borderRadius: 12,
  },
  previewLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  previewValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4ade80",
  },
  confirmBtn: {
    backgroundColor: "#38bdf8",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
});
