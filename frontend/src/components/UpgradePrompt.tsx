import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", BD = "rgba(233,233,237,0.1)";

type Props = {
  visible: boolean;
  onClose: () => void;
  feature: string;
  description: string;
};

const BASIC_PERKS = [
  "Up to 5 medications",
  "30-day history",
  "Full yoga library",
  "3 caregivers via WhatsApp",
  "CSV data export",
  "10 nearby results",
  "2 doctor appointments",
];

const PREMIUM_PERKS = [
  "Unlimited medications",
  "90-day history",
  "Daily AI insights",
  "Unlimited caregivers",
  "Brand vs generic lookup",
  "Medicine scanner",
  "Unlimited appointments",
  "20 nearby results",
];

export function UpgradePrompt({ visible, onClose, feature, description }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.iconWrap}>
            <Ionicons name="lock-closed" size={24} color={AC} />
          </View>
          <Text style={s.title}>Premium feature</Text>
          <Text style={s.feature}>{feature}</Text>
          <Text style={s.desc}>{description}</Text>

          {/* Two plan cards */}
          <View style={s.plans}>
            {/* Basic Plan */}
            <View style={[s.planCard, { borderColor: "rgba(74,222,128,0.3)" }]}>
              <View style={s.planHeader}>
                <Text style={s.planName}>Basic</Text>
                <View style={s.priceRow}>
                  <Text style={[s.price, { color: "#4ade80" }]}>₹30</Text>
                  <Text style={s.period}>/month</Text>
                </View>
              </View>
              {BASIC_PERKS.map(p => (
                <View key={p} style={s.perkRow}>
                  <Ionicons name="checkmark" size={12} color="#4ade80" />
                  <Text style={s.perkText}>{p}</Text>
                </View>
              ))}
            </View>

            {/* Premium Plan */}
            <View style={[s.planCard, { borderColor: "rgba(145,132,217,0.4)", backgroundColor: "rgba(145,132,217,0.06)" }]}>
              <View style={[s.badge, { alignSelf: "flex-start", marginBottom: 6 }]}>
                <Text style={s.badgeTx}>Best value</Text>
              </View>
              <View style={s.planHeader}>
                <Text style={s.planName}>Premium</Text>
                <View style={s.priceRow}>
                  <Text style={[s.price, { color: AC }]}>₹99</Text>
                  <Text style={s.period}>/month</Text>
                </View>
              </View>
              {PREMIUM_PERKS.map(p => (
                <View key={p} style={s.perkRow}>
                  <Ionicons name="checkmark" size={12} color={AC} />
                  <Text style={s.perkText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: 11, color: TM, textAlign: "center", marginBottom: 12, lineHeight: 16 }}>
            Contact support@pillcare.in to upgrade.{"\n"}Payments via UPI, net banking, or card.
          </Text>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTx}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 16 },
  box: { backgroundColor: SF, borderRadius: 20, padding: 20, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: BD },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(145,132,217,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12, alignSelf: "center" },
  title: { fontSize: 10, fontWeight: "700", color: AC, textTransform: "uppercase", letterSpacing: 0.1, textAlign: "center", marginBottom: 4 },
  feature: { fontSize: 17, fontWeight: "700", color: TX, textAlign: "center", marginBottom: 4 },
  desc: { fontSize: 13, color: TM, textAlign: "center", lineHeight: 19, marginBottom: 16 },
  plans: { flexDirection: "row", gap: 10, marginBottom: 14 },
  planCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BD },
  planHeader: { marginBottom: 10 },
  planName: { fontSize: 13, fontWeight: "700", color: TX, marginBottom: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  price: { fontSize: 22, fontWeight: "700" },
  period: { fontSize: 11, color: TM },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  perkText: { fontSize: 11, color: TM, flex: 1 },
  badge: { backgroundColor: "rgba(145,132,217,0.2)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTx: { fontSize: 9, fontWeight: "700", color: AC, textTransform: "uppercase", letterSpacing: 0.05 },
  closeBtn: { alignItems: "center", paddingVertical: 10 },
  closeTx: { fontSize: 13, color: TM },
});
