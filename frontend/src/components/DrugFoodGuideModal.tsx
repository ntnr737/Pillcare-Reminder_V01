import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";

interface DrugFoodGuideProps {
  visible: boolean;
  onClose: () => void;
  targetMedicationName?: string;
  guide: {
    dos?: string[];
    donts?: string[];
    guides?: Array<{
      medication: string;
      category?: string;
      dos?: string[];
      donts?: string[];
    }>;
  } | null;
}

export function DrugFoodGuideModal({ visible, onClose, guide, targetMedicationName }: DrugFoodGuideProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const trimmedTarget = targetMedicationName?.trim() || "";
  const matchedGuide = trimmedTarget && guide?.guides
    ? guide.guides.find(
        (g) =>
          g.medication.toLowerCase().includes(trimmedTarget.toLowerCase()) ||
          trimmedTarget.toLowerCase().includes(g.medication.toLowerCase())
      )
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={s.headerRow}>
            <View style={s.headerTitle}>
              <Ionicons name="restaurant-outline" size={20} color="#10B981" />
              <Text style={[s.title, { color: theme.textPrimary }]}>
                {trimmedTarget ? `Interactions: ${trimmedTarget}` : t("drugFoodModal.title", "Drug-Food Do's & Don'ts Guide")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {/* Target Medication Specific Match or Safe Unknown Notice */}
            {trimmedTarget ? (
              matchedGuide ? (
                <View style={[s.medGuideCard, { backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4", borderColor: "#10B981" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={[s.medName, { color: "#10B981", fontWeight: "800" }]}>
                      {matchedGuide.medication} {matchedGuide.category ? `(${matchedGuide.category})` : ""}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>Clinical Drug-Food Rules:</Text>
                  {matchedGuide.dos?.map((d, i) => (
                    <Text key={i} style={s.doCheck}>✓ {d}</Text>
                  ))}
                  {matchedGuide.donts?.map((d, i) => (
                    <Text key={i} style={s.dontCross}>✗ {d}</Text>
                  ))}
                </View>
              ) : (
                <View style={[s.medGuideCard, { backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb", borderColor: "rgba(245,158,11,0.3)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#F59E0B" }}>
                      No Specific Interaction Data Found
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
                    No critical food or beverage interactions are specifically cataloged for &quot;{trimmedTarget}&quot;. Follow standard prescribing directions or consult your doctor/pharmacist.
                  </Text>
                </View>
              )
            ) : null}

            {/* DO's List */}
            <View style={s.dosCard}>
              <View style={s.cardTitleRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.dosTitle}>{t("drugFoodModal.recommendedDos", "RECOMMENDED DO'S")}</Text>
              </View>
              {(guide?.dos || []).map((doItem: string, idx: number) => (
                <View key={idx} style={s.bulletRow}>
                  <Text style={s.dosBullet}>•</Text>
                  <Text style={[s.itemText, { color: theme.textPrimary }]}>{doItem}</Text>
                </View>
              ))}
            </View>

            {/* DON'TS List */}
            <View style={s.dontsCard}>
              <View style={s.cardTitleRow}>
                <Ionicons name="close-circle" size={16} color="#ef4444" />
                <Text style={s.dontsTitle}>{t("drugFoodModal.criticalDonts", "CRITICAL DON'TS")}</Text>
              </View>
              {(guide?.donts || []).map((dontItem: string, idx: number) => (
                <View key={idx} style={s.bulletRow}>
                  <Text style={s.dontsBullet}>•</Text>
                  <Text style={[s.itemText, { color: theme.textPrimary }]}>{dontItem}</Text>
                </View>
              ))}
            </View>

            {/* Per-Medication Guides */}
            {guide?.guides && guide.guides.length > 0 && !matchedGuide && (
              <>
                <Text style={[s.sectionHeader, { color: theme.textSecondary }]}>{t("drugFoodModal.medSpecific", "Medication-Specific Guidance:")}</Text>
                {guide.guides.map((g, idx) => (
                  <View key={idx} style={[s.medGuideCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", borderColor: theme.surfaceBorder }]}>
                    <Text style={[s.medName, { color: theme.textPrimary }]}>
                      {g.medication} {g.category ? <Text style={[s.category, { color: theme.accent }]}>({g.category})</Text> : null}
                    </Text>
                    {g.dos?.map((d, i) => (
                      <Text key={i} style={s.doCheck}>✓ {d}</Text>
                    ))}
                    {g.donts?.map((d, i) => (
                      <Text key={i} style={s.dontCross}>✗ {d}</Text>
                    ))}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
    gap: 16,
    zIndex: 10,
    elevation: 10,
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  dosCard: {
    backgroundColor: "rgba(74,222,128,0.08)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
    gap: 8,
  },
  dontsCard: {
    backgroundColor: "rgba(239,68,68,0.08)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dosTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  dontsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  dosBullet: {
    color: "#10B981",
    fontWeight: "700",
  },
  dontsBullet: {
    color: "#ef4444",
    fontWeight: "700",
  },
  itemText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  medGuideCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  medName: {
    fontSize: 14,
    fontWeight: "700",
  },
  category: {
    fontSize: 11,
    fontWeight: "500",
  },
  doCheck: {
    fontSize: 11,
    color: "#10B981",
  },
  dontCross: {
    fontSize: 11,
    color: "#ef4444",
  },
});
