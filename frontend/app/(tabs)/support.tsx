import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { signOut } from "@/src/lib/auth";
import { api } from "@/src/lib/api";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

const EMERGENCY: Record<string, { number: string; label: string }> = {
  US: { number: "911", label: "Police, Fire & Medical — nationwide" },
  IN: { number: "112", label: "All-in-one emergency (also 102 ambulance / 108 medical)" },
  GB: { number: "999", label: "Police, Fire & Ambulance" },
  CA: { number: "911", label: "Police, Fire & Medical" },
  AU: { number: "000", label: "Police, Fire & Ambulance" },
  RU: { number: "112", label: "Emergency services" },
  DE: { number: "112", label: "Emergency services" },
  FR: { number: "15", label: "SAMU Medical Emergency (also 17 police, 18 fire)" },
  CN: { number: "120", label: "Medical Emergency" },
  JP: { number: "119", label: "Fire & Ambulance (110 for police)" },
  BR: { number: "192", label: "SAMU Medical Emergency" },
  ZA: { number: "10177", label: "Ambulance" },
  DEFAULT: { number: "112", label: "International emergency number" },
};

const PRIVACY_SECTIONS = [
  { icon: "server-outline", title: "What we collect", body: "Medication names, doses, schedules, and the times you mark them taken or skipped — plus basic profile info (name, birth year, gender) to personalize reminders and yoga suggestions." },
  { icon: "ban-outline", title: "What we never do", body: "We never sell your health data, never share it with advertisers, and never show your medication list to anyone but you and the caregivers you explicitly connect." },
  { icon: "lock-closed-outline", title: "How encryption works", body: "All data is encrypted in transit (TLS) and at rest (AES-256). Your medication history is tied to your account only — our team cannot read it without your permission." },
  { icon: "bug-outline", title: "Crash & usage analytics", body: "We collect anonymized crash reports and app-usage patterns to fix bugs. This data is never linked back to your identity or health records." },
];

const FAQS = [
  "How do I add a new medication?",
  "Can I set multiple reminders?",
  "How does the caregiver alert work?",
  "How do I log my blood pressure?",
  "Can I export my health data?",
  "How do I connect a caregiver via WhatsApp?",
];

type EmStatus = "idle" | "locating" | "ready" | "error";

export default function Support() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emStatus, setEmStatus] = useState<EmStatus>("idle");
  const [emPlace, setEmPlace] = useState("");
  const [emNumber, setEmNumber] = useState("");
  const [emLabel, setEmLabel] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [caregiverOpen, setCaregiverOpen] = useState(false);
  const [savingCg, setSavingCg] = useState(false);
  const [so, setSo] = useState(false);

  const openEmergency = async () => {
    setEmergencyOpen(true); setEmStatus("locating");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("denied");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const cc = (geo[0]?.isoCountryCode || "DEFAULT").toUpperCase();
      const info = EMERGENCY[cc] || EMERGENCY.DEFAULT;
      const place = [geo[0]?.city, geo[0]?.region, geo[0]?.country].filter(Boolean).join(", ");
      setEmPlace(place || "Your area"); setEmNumber(info.number); setEmLabel(info.label); setEmStatus("ready");
    } catch {
      setEmPlace("Your area"); setEmNumber(EMERGENCY.DEFAULT.number); setEmLabel(EMERGENCY.DEFAULT.label); setEmStatus("error");
    }
  };

  const saveCaregiverPhone = async () => {
    if (!caregiverPhone.trim()) return;
    setSavingCg(true);
    try {
      const profile = await api.getProfile();
      await api.upsertProfile({ ...profile, caregiver_phone: caregiverPhone.trim() });
      Alert.alert("Connected!", "Your caregiver will now receive WhatsApp alerts when you miss a dose.");
      setCaregiverOpen(false);
    } catch {
      Alert.alert("Error", "Could not save caregiver number. Please try again.");
    } finally { setSavingCg(false); }
  };

  const handleSO = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { setSo(true); try { await signOut(); router.replace("/sign-in"); } catch { setSo(false); } } }
    ]);
  };

  const faqs = FAQS.filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Text style={s.title}>Support</Text>
      <View style={s.searchW}><Ionicons name="search-outline" size={14} color={TM} style={{ position: "absolute", left: 12, zIndex: 1 }} /><TextInput value={search} onChangeText={setSearch} placeholder="Search for help" placeholderTextColor={TM} style={s.searchI} /></View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Quick actions 2x2 */}
        <View style={s.grid}>
          <TouchableOpacity style={s.qCard} onPress={() => { }}>
            <View style={s.qIco}><Ionicons name="call-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>Call Doctor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={() => { }}>
            <View style={s.qIco}><Ionicons name="calendar-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>Book Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={openEmergency}>
            <View style={[s.qIco, { backgroundColor: "rgba(229,133,133,0.14)" }]}><Ionicons name="medkit-outline" size={15} color="#e58585" /></View>
            <Text style={[s.qLbl, { color: "#e58585" }]}>Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={() => { }}>
            <View style={s.qIco}><Ionicons name="person-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>My Profile</Text>
          </TouchableOpacity>
        </View>

        {/* CAREGIVER & FAMILY */}
        <Text style={s.secL}>CAREGIVER & FAMILY</Text>
        <View style={s.card}>
          <View style={s.cRow}>
            <View style={[s.cIco, { backgroundColor: "rgba(74,222,128,0.14)" }]}><Ionicons name="logo-whatsapp" size={17} color="#4ade80" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cT}>Connect via WhatsApp</Text>
              <Text style={s.cS}>Missed-dose alerts sent to your caregiver's WhatsApp</Text>
            </View>
            <TouchableOpacity style={s.connectBtn} onPress={() => setCaregiverOpen(true)}><Text style={s.connectTx}>Connect</Text></TouchableOpacity>
          </View>
        </View>

        {/* PRIVACY */}
        <Text style={s.secL}>PRIVACY & ENCRYPTION</Text>
        <TouchableOpacity style={s.card} onPress={() => setPrivacyOpen(true)}>
          <View style={s.cRow}>
            <View style={s.cIco}><Ionicons name="shield-checkmark" size={17} color={A3} /></View>
            <View style={{ flex: 1 }}><Text style={s.cT}>Your health data, explained</Text><Text style={s.cS}>What we collect, encryption, and what we never do</Text></View>
            <Ionicons name="chevron-forward" size={13} color={TM} />
          </View>
        </TouchableOpacity>

        {/* FAQs */}
        <Text style={s.secL}>FREQUENTLY ASKED</Text>
        {faqs.map((f, i) => (<TouchableOpacity key={i} style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[s.cT, { flex: 1 }]}>{f}</Text>
            <Ionicons name="chevron-forward" size={13} color={TM} />
          </View>
        </TouchableOpacity>))}

        {/* Sign out */}
        <TouchableOpacity style={[s.card, { borderColor: "rgba(229,133,133,0.2)" }]} onPress={handleSO}>
          <View style={s.cRow}>
            <View style={[s.cIco, { backgroundColor: "rgba(229,133,133,0.1)" }]}><Ionicons name="log-out-outline" size={16} color="#e58585" /></View>
            <Text style={[s.cT, { color: "#e58585" }]}>{so ? "Signing out…" : "Sign Out"}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 }}>
          <Ionicons name="lock-closed-outline" size={11} color={TM} />
          <Text style={{ fontSize: 10, color: TM }}>Your data is safe and secure with us.</Text>
        </View>
      </ScrollView>

      {/* Emergency Modal */}
      <Modal visible={emergencyOpen} transparent animationType="slide" onRequestClose={() => setEmergencyOpen(false)}>
        <View style={s.ovl}><View style={s.sheet}>
          <View style={s.handle} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons name="medkit" size={17} color="#e58585" />
            <Text style={s.sheetT}>Emergency Helpline</Text>
          </View>
          {emStatus === "locating" && <Text style={s.cS}>Locating you to find the right local number…</Text>}
          {emStatus === "error" && <Text style={s.cS}>Couldn't detect location. Showing international emergency number.</Text>}
          {(emStatus === "ready" || emStatus === "error") && (
            <View style={[s.card, { borderColor: "rgba(229,133,133,0.3)", flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <View style={[s.cIco, { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(229,133,133,0.14)" }]}><Ionicons name="call" size={18} color="#e58585" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cS}>{emPlace || "Your area"}</Text>
                <Text style={[s.cT, { fontSize: 22, fontWeight: "700", color: "#e58585" }]}>{emNumber || "112"}</Text>
                <Text style={s.cS}>{emLabel}</Text>
              </View>
              <TouchableOpacity style={[s.connectBtn, { backgroundColor: "#e58585", borderColor: "#e58585" }]} onPress={() => Linking.openURL(`tel:${emNumber || "112"}`)}>
                <Text style={[s.connectTx, { color: "#fff" }]}>Call</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={s.cS}>This number routes to your region's emergency dispatch based on your GPS location.</Text>
          <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setEmergencyOpen(false)}><Text style={{ color: TM }}>Close</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Caregiver WhatsApp Modal */}
      <Modal visible={caregiverOpen} transparent animationType="slide" onRequestClose={() => setCaregiverOpen(false)}>
        <View style={s.ovl}><View style={s.sheet}>
          <View style={s.handle} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="logo-whatsapp" size={20} color="#4ade80" />
            <Text style={s.sheetT}>Connect Caregiver via WhatsApp</Text>
          </View>
          <Text style={s.cS}>Enter your caregiver's WhatsApp number. They'll receive alerts when you miss a dose.</Text>
          <TextInput
            value={caregiverPhone} onChangeText={setCaregiverPhone}
            placeholder="+91 XXXXX XXXXX" placeholderTextColor={TM}
            keyboardType="phone-pad" style={s.inp}
          />
          <TouchableOpacity style={[s.subBtn, { backgroundColor: "#4ade80" }]} onPress={saveCaregiverPhone} disabled={savingCg || !caregiverPhone.trim()}>
            <Text style={[s.subT, { color: "#000" }]}>{savingCg ? "Saving…" : "Save & Connect"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setCaregiverOpen(false)}><Text style={{ color: TM }}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={privacyOpen} transparent animationType="slide" onRequestClose={() => setPrivacyOpen(false)}>
        <View style={s.ovl}><View style={[s.sheet, { maxHeight: "85%" }]}>
          <View style={s.handle} />
          <Text style={s.sheetT}>Your Health Data, Explained</Text>
          <ScrollView>
            {PRIVACY_SECTIONS.map(p => (<View key={p.title} style={[s.card, { marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={p.icon as any} size={15} color={A3} /><Text style={s.cT}>{p.title}</Text>
              </View>
              <Text style={[s.cS, { lineHeight: 16 }]}>{p.body}</Text>
            </View>))}
          </ScrollView>
          <TouchableOpacity style={{ padding: 12, alignItems: "center" }} onPress={() => setPrivacyOpen(false)}><Text style={{ color: TM }}>Close</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingTop: 10 }, title: { fontSize: 20, fontWeight: "700", color: TX, letterSpacing: -.4, paddingHorizontal: 16, paddingBottom: 8 },
  searchW: { position: "relative", justifyContent: "center", marginHorizontal: 16, marginBottom: 10 },
  searchI: { backgroundColor: SF, borderRadius: 10, padding: 12, paddingLeft: 34, color: TX, fontSize: 13, borderWidth: 1, borderColor: BD },
  body: { padding: 16, paddingBottom: 110, gap: 10 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qCard: { width: "48%", backgroundColor: SF, borderRadius: 14, padding: 12, alignItems: "center", gap: 6, borderWidth: 1, borderColor: BD },
  qIco: { width: 32, height: 32, borderRadius: 16, backgroundColor: AB, alignItems: "center", justifyContent: "center" }, qLbl: { fontSize: 11, fontWeight: "600", color: TX, textAlign: "center" },
  secL: { fontSize: 10, letterSpacing: 1, color: TM, fontWeight: "700", marginTop: 4 },
  card: { backgroundColor: SF, borderRadius: 14, padding: 13, gap: 8, borderWidth: 1, borderColor: BD },
  cRow: { flexDirection: "row", alignItems: "center", gap: 10 }, cIco: { width: 34, height: 34, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 13, fontWeight: "600", color: TX }, cS: { fontSize: 10, color: TM, marginTop: 1, lineHeight: 15 },
  connectBtn: { paddingHorizontal: 12, height: 30, borderRadius: 8, backgroundColor: SF, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" }, connectTx: { fontSize: 11, color: TX, fontWeight: "600" },
  ovl: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: N8, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.2)", alignSelf: "center", marginBottom: 6 }, sheetT: { fontSize: 16, fontWeight: "700", color: TX },
  inp: { backgroundColor: "#1e2030", borderRadius: 10, padding: 12, color: TX, fontSize: 14, borderWidth: 1, borderColor: BD, marginTop: 4 },
  subBtn: { backgroundColor: AC, borderRadius: 11, padding: 13, alignItems: "center", marginTop: 6 }, subT: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
