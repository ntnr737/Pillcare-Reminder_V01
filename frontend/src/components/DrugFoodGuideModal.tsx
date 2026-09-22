import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/theme";

interface DrugFoodGuideProps {
  visible: boolean;
  onClose: () => void;
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

export function DrugFoodGuideModal({ visible, onClose, guide }: DrugFoodGuideProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <View style={s.headerTitle}>
              <Ionicons name="restaurant-outline" size={20} color={COLORS.SUCCESS} />
              <Text style={s.title}>Drug-Food Do's & Don'ts Guide</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.TX} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {/* DO's List */}
            <View style={s.dosCard}>
              <View style={s.cardTitleRow}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS} />
                <Text style={s.dosTitle}>RECOMMENDED DO'S</Text>
              </View>
              {(guide?.dos || []).map((doItem: string, idx: number) => (
                <View key={idx} style={s.bulletRow}>
                  <Text style={s.dosBullet}>•</Text>
                  <Text style={s.itemText}>{doItem}</Text>
                </View>
              ))}
            </View>

            {/* DON'TS List */}
            <View style={s.dontsCard}>
              <View style={s.cardTitleRow}>
                <Ionicons name="close-circle" size={16} color="#ef4444" />
                <Text style={s.dontsTitle}>CRITICAL DON'TS</Text>
              </View>
              {(guide?.donts || []).map((dontItem: string, idx: number) => (
                <View key={idx} style={s.bulletRow}>
                  <Text style={s.dontsBullet}>•</Text>
                  <Text style={s.itemText}>{dontItem}</Text>
                </View>
              ))}
            </View>

            {/* Per-Medication Guides */}
            {guide?.guides && guide.guides.length > 0 && (
              <>
                <Text style={s.sectionHeader}>Medication-Specific Guidance:</Text>
                {guide.guides.map((g, idx) => (
                  <View key={idx} style={s.medGuideCard}>
                    <Text style={s.medName}>
                      {g.medication} {g.category ? <Text style={s.category}>({g.category})</Text> : null}
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
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1c1e2d",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
    gap: 16,
    zIndex: 10,
    elevation: 10,
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
    color: "#fff",
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
    color: COLORS.SUCCESS,
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
    color: COLORS.SUCCESS,
    fontWeight: "700",
  },
  dontsBullet: {
    color: "#ef4444",
    fontWeight: "700",
  },
  itemText: {
    fontSize: 12,
    color: COLORS.TX,
    flex: 1,
    lineHeight: 17,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.A3,
    marginTop: 4,
  },
  medGuideCard: {
    backgroundColor: "#252837",
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  medName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TX,
  },
  category: {
    fontSize: 11,
    color: COLORS.A3,
    fontWeight: "500",
  },
  doCheck: {
    fontSize: 11,
    color: COLORS.SUCCESS,
  },
  dontCross: {
    fontSize: 11,
    color: "#ef4444",
  },
});
