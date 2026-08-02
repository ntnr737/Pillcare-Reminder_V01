import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", BD = "rgba(233,233,237,0.1)";

type Props = {
  visible: boolean;
  onClose: () => void;
  feature: string;
  description: string;
};

export function UpgradePrompt({ visible, onClose, feature, description }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.iconWrap}>
            <Ionicons name="lock-closed" size={28} color={AC} />
          </View>
          <Text style={s.title}>Premium feature</Text>
          <Text style={s.feature}>{feature}</Text>
          <Text style={s.desc}>{description}</Text>
          <View style={s.planBox}>
            <Text style={s.planTitle}>Premium plan</Text>
            <Text style={s.planPrice}>Coming soon</Text>
            <Text style={{ fontSize: 12, color: TM, marginBottom: 8 }}>Premium features are launching shortly. You will be notified when available.</Text>
            <View style={s.perks}>
              {["Unlimited medications","90-day history","Full yoga library","Daily AI insights","CSV data export","20 nearby results","Unlimited caregivers"].map(p => (
                <View key={p} style={s.perkRow}>
                  <Ionicons name="checkmark-circle" size={14} color={AC} />
                  <Text style={s.perkText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity style={s.upgradeBtn} onPress={onClose}>
            <Text style={s.upgradeTx}>Upgrade to Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTx}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.75)", alignItems:"center", justifyContent:"center", padding:24 },
  box: { backgroundColor:SF, borderRadius:20, padding:24, width:"100%", maxWidth:360, borderWidth:1, borderColor:BD },
  iconWrap: { width:56, height:56, borderRadius:16, backgroundColor:"rgba(145,132,217,0.15)", alignItems:"center", justifyContent:"center", marginBottom:16, alignSelf:"center" },
  title: { fontSize:11, fontWeight:"700", letterSpacing:0.1, color:AC, textTransform:"uppercase", textAlign:"center", marginBottom:6 },
  feature: { fontSize:18, fontWeight:"700", color:TX, textAlign:"center", marginBottom:6 },
  desc: { fontSize:13, color:TM, textAlign:"center", lineHeight:19, marginBottom:20 },
  planBox: { backgroundColor:"rgba(145,132,217,0.08)", borderRadius:14, padding:16, borderWidth:1, borderColor:"rgba(145,132,217,0.2)", marginBottom:16 },
  planTitle: { fontSize:12, fontWeight:"700", color:AC, marginBottom:2 },
  planPrice: { fontSize:22, fontWeight:"700", color:TX, marginBottom:12 },
  perks: { gap:7 },
  perkRow: { flexDirection:"row", alignItems:"center", gap:8 },
  perkText: { fontSize:13, color:TM },
  upgradeBtn: { backgroundColor:AC, borderRadius:12, paddingVertical:14, alignItems:"center", marginBottom:10 },
  upgradeTx: { fontSize:15, fontWeight:"700", color:"#fff" },
  closeBtn: { alignItems:"center", paddingVertical:8 },
  closeTx: { fontSize:13, color:TM },
});
