import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", BD = "rgba(233,233,237,0.1)";

const CONSENT_KEY = "pillcare_consent_v1";

export async function hasConsented(): Promise<boolean> {
  const val = await AsyncStorage.getItem(CONSENT_KEY);
  return val === "true";
}

export default function ConsentScreen() {
  const router = useRouter();

  const handleAgree = async () => {
    await AsyncStorage.setItem(CONSENT_KEY, "true");
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark" size={32} color={AC} />
          </View>
          <Text style={s.title}>Your privacy matters</Text>
          <Text style={s.sub}>Before you start, please review how PillCare uses your health data.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>What we collect and why</Text>
          {[
            { icon: "medical-outline", text: "Medications and schedules you add" },
            { icon: "checkmark-circle-outline", text: "Dose history (taken, skipped, missed)" },
            { icon: "location-outline", text: "Your city and state (for nearby search)" },
            { icon: "people-outline", text: "Caregiver contact if you connect one" },
            { icon: "phone-portrait-outline", text: "Device info for compatibility and support" },
          ].map((d, i) => (
            <View key={i} style={s.dataRow}>
              <Ionicons name={d.icon as any} size={16} color={AC} />
              <Text style={s.dataText}>{d.text}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>What we never collect</Text>
          {["Financial or payment information","Biometric data","Real-time GPS continuously","Contacts, messages or call history"].map((item, i) => (
            <View key={i} style={s.dataRow}>
              <Ionicons name="close-circle-outline" size={16} color={TM} />
              <Text style={[s.dataText, { color: TM }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Your rights</Text>
          <Text style={s.bodyText}>You can access, update, or delete your data at any time. We never sell your data. We comply with India's DPDP Act 2023 and GDPR.</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://pillcare.in/privacy.html")}>
            <Text style={s.link}>Read our full Privacy Policy ↗</Text>
          </TouchableOpacity>
        </View>

        <View style={s.consentBox}>
          <Ionicons name="information-circle-outline" size={16} color={AC} style={{ marginTop: 2 }} />
          <Text style={s.consentText}>
            By tapping "I agree", you consent to PillCare collecting and using the data listed above. You can withdraw consent by deleting your account at any time.
          </Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.agreeBtn} onPress={handleAgree}>
          <Text style={s.agreeTx}>I agree — continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.declineBtn} onPress={() => {}}>
          <Text style={s.declineTx}>I do not agree</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor:BG },
  scroll: { padding:24, paddingBottom:16 },
  header: { alignItems:"center", marginBottom:28 },
  iconWrap: { width:64, height:64, borderRadius:20, backgroundColor:"rgba(145,132,217,0.12)", alignItems:"center", justifyContent:"center", marginBottom:16 },
  title: { fontSize:22, fontWeight:"700", color:TX, textAlign:"center", marginBottom:10 },
  sub: { fontSize:14, color:TM, textAlign:"center", lineHeight:21 },
  section: { backgroundColor:SF, borderRadius:14, padding:16, marginBottom:12, borderWidth:1, borderColor:BD },
  sectionTitle: { fontSize:11, fontWeight:"700", color:AC, textTransform:"uppercase", letterSpacing:0.08, marginBottom:12 },
  dataRow: { flexDirection:"row", alignItems:"flex-start", gap:10, marginBottom:10 },
  dataText: { fontSize:14, color:TX, flex:1, lineHeight:20 },
  bodyText: { fontSize:14, color:TM, lineHeight:21, marginBottom:10 },
  link: { fontSize:13, color:AC, fontWeight:"600" },
  consentBox: { flexDirection:"row", gap:10, backgroundColor:"rgba(145,132,217,0.08)", borderRadius:12, padding:14, borderWidth:1, borderColor:"rgba(145,132,217,0.2)", marginBottom:8 },
  consentText: { fontSize:12, color:TM, flex:1, lineHeight:18 },
  footer: { padding:20, paddingBottom:8, gap:10, borderTopWidth:1, borderTopColor:BD },
  agreeBtn: { backgroundColor:AC, borderRadius:14, paddingVertical:15, alignItems:"center" },
  agreeTx: { fontSize:16, fontWeight:"700", color:"#fff" },
  declineBtn: { paddingVertical:12, alignItems:"center" },
  declineTx: { fontSize:14, color:TM },
});
