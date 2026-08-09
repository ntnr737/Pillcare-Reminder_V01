import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { signOut } from "@/src/lib/auth";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";
import { useEffect } from "react";

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
  {
    icon: "document-text-outline",
    title: "DPDP Act 2023 Compliance",
    body: "PillCare complies with India's Digital Personal Data Protection Act 2023 (DPDP Act). We collect your health data only with your explicit consent, use it only for the purposes stated, and allow you to access, correct or delete it at any time. We report any data breach to the Data Protection Board of India within the required timeframe.",
  },
  {
    icon: "server-outline",
    title: "What we collect",
    body: "Medication names, doses, schedules and intake records. Basic profile info (name, birth year, gender) for personalised reminders. Measurements, activities and mood you log. Your city/state for location-based features. Caregiver phone number only if you add one.",
  },
  {
    icon: "ban-outline",
    title: "What we never do",
    body: "We never sell your health data to anyone. We never share it with advertisers. We never show your medication list to anyone except you and caregivers you explicitly connect. We never use your data to train AI models without your consent.",
  },
  {
    icon: "lock-closed-outline",
    title: "End-to-end encryption",
    body: "Your data is protected with bank-grade 256-bit encryption in transit and at rest. It is stored on certified enterprise cloud infrastructure across secure global data centres. Your health records are accessible only to you — our team cannot read your data without your explicit permission.",
  },
  {
    icon: "people-outline",
    title: "Third-party services",
    body: "Groq AI receives only your medication names (no personal identity) to generate wellness tips. OpenFDA receives only drug brand names. WasenderAPI receives only your caregiver's phone number to send alerts. None of these services can identify you from the data sent.",
  },
  {
    icon: "trash-outline",
    title: "Your rights under DPDP Act",
    body: "You have the right to: access all data we hold (use CSV export), correct inaccurate data (edit in app), delete all your data (Support → request deletion), and withdraw consent at any time. Contact support@pillcare.in for any data requests.",
  },
];

const FAQS = [
  { q: "How do I add a new medication?", a: "Tap the + button on any screen → Add Medication. Enter the brand name and we automatically find the generic name. Set your dose, times and stock level." },
  { q: "Can I set multiple reminders for one medicine?", a: "Yes. When adding a medication, you can add multiple times (morning, afternoon, evening). Each time gets its own reminder notification." },
  { q: "How does the caregiver WhatsApp alert work?", a: "Go to Support → Connect via WhatsApp → enter your caregiver's number. If you miss a dose, they receive a WhatsApp message at 10 PM IST with your daily summary." },
  { q: "Why can't I mark a medicine as Taken in the morning if it is scheduled for evening?", a: "PillCare time-locks each dose to a 2-hour window before and 4 hours after the scheduled time. This prevents accidental marking and ensures accurate adherence tracking." },
  { q: "How do I log my blood pressure or glucose?", a: "Go to Treatment → Measurements tab → tap Blood Pressure or Glucose → enter your reading. It is saved to your history and shown in the Progress screen." },
  { q: "Can I export my health data?", a: "Yes. The backend supports CSV export via the API. A one-tap export button is coming in the next update." },
  { q: "How do I connect a smartband or fitness tracker?", a: "Install Google Health Connect from the Play Store, then go to Progress → Connect. Your smartband data (steps, heart rate, sleep) syncs automatically once permissions are granted." },
  { q: "Is my data stored securely?", a: "Yes. Your data is encrypted with 256-bit encryption both in transit and at rest, stored on certified enterprise cloud infrastructure with multiple layers of security and access controls. We comply with data protection laws applicable in your region worldwide. For data requests, contact support@pillcare.in." },
  { q: "How do I delete my account and all data?", a: "Email support@pillcare.in with your registered Google email and request account deletion. We will delete all your data within 30 days as required by the DPDP Act 2023." },
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
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [caregiverOpen, setCaregiverOpen] = useState(false);
  const [savingCg, setSavingCg] = useState(false);
  const [so, setSo] = useState(false);
  const [caregiverConnected, setCaregiverConnected] = useState(false);
  const [connectedNumber, setConnectedNumber] = useState("");

  useEffect(() => {
    api.getProfile().then(p => {
      if (p?.caregiver_phone) {
        setCaregiverConnected(true);
        const num = p.caregiver_phone;
        setConnectedNumber(num);
        setCaregiverPhone(num);
      }
      // Also populate email if needed
    }).catch(() => {});
  }, []);

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
      await api.updateCaregiver(caregiverPhone.trim());
      track("caregiver_connected");
      Alert.alert("Connected!", `Caregiver number ${caregiverPhone.trim()} saved. They will receive WhatsApp alerts when you miss a dose.`);
      setCaregiverConnected(true);
      setConnectedNumber(caregiverPhone.trim());
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

  const faqs = FAQS.filter(f => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          <TouchableOpacity style={s.qCard} onPress={() => router.push("/appointments")}>
            <View style={s.qIco}><Ionicons name="calendar-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>Book Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={openEmergency}>
            <View style={[s.qIco, { backgroundColor: "rgba(229,133,133,0.14)" }]}><Ionicons name="medkit-outline" size={15} color="#e58585" /></View>
            <Text style={[s.qLbl, { color: "#e58585" }]}>Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={() => router.push("/profile")}>
            <View style={s.qIco}><Ionicons name="person-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>My Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={() => (router as any).push("/nearby?type=pharmacy")}>
            <View style={[s.qIco, { backgroundColor: "rgba(74,222,128,0.12)" }]}><Ionicons name="medkit-outline" size={15} color="#4ade80" /></View>
            <Text style={s.qLbl}>Medical Store</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qCard} onPress={() => (router as any).push("/nearby?type=diagnostic")}>
            <View style={[s.qIco, { backgroundColor: "rgba(161,150,219,0.15)" }]}><Ionicons name="flask-outline" size={15} color={A3} /></View>
            <Text style={s.qLbl}>Diagnostic Lab</Text>
          </TouchableOpacity>
        </View>

        {/* CAREGIVER & FAMILY */}
        <Text style={s.secL}>CAREGIVER & FAMILY</Text>
        <View style={[s.card, { position: "relative" }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={[s.cIco, { backgroundColor: "rgba(74,222,128,0.14)", marginTop: 2 }]}>
              <Ionicons name="logo-whatsapp" size={17} color="#4ade80" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cT, { flexShrink: 1 }]} numberOfLines={1}>Connect via WhatsApp</Text>
              <Text style={s.cS} numberOfLines={2}>
                {caregiverConnected && connectedNumber
                  ? `Alerts go to +${connectedNumber.replace(/^\+/, "")}`
                  : "Missed-dose alerts sent to your caregiver's WhatsApp"}
              </Text>
              <TouchableOpacity
                style={[s.connectBtn, { position: "absolute", top:0, right: 0 },
                  caregiverConnected && { backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" }]}
                onPress={() => setCaregiverOpen(true)}>
                {caregiverConnected && <Ionicons name="checkmark-circle" size={12} color="#4ade80" />}
                <Text style={[s.connectTx, caregiverConnected && { color: "#4ade80" }]}>
                  {caregiverConnected ? "Connected" : "Connect"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* DATA & EXPORT */}
        <Text style={s.secL}>YOUR DATA</Text>
        <TouchableOpacity style={s.card} onPress={async () => {
          const { getFeatures } = await import("@/src/lib/features");
          const { api } = await import("@/src/lib/api");
          const { Linking } = await import("react-native");
          track("export_tapped");
          if (!getFeatures().export_data) {
            Alert.alert("Premium feature", "CSV export is available on the Premium plan. Upgrade to download your complete health history.");
            return;
          }
          track("export_completed");
          Linking.openURL(api.exportCsvUrl());
        }}>
          <View style={s.cRow}>
            <View style={s.cIco}><Ionicons name="download-outline" size={17} color={A3} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cT}>Export my health data</Text>
              <Text style={s.cS}>Download all your doses, measurements and activities as CSV</Text>
            </View>
            <Ionicons name="chevron-forward" size={13} color={TM} />
          </View>
        </TouchableOpacity>

        {/* PRIVACY & LEGAL */}
        <Text style={s.secL}>PRIVACY & LEGAL</Text>
        {[
          { label: "Privacy Policy", sub: "How we collect and protect your data", url: "https://pillcare.in/privacy.html", icon: "shield-checkmark" },
          { label: "Terms of Service", sub: "Rules and conditions of using PillCare", url: "https://pillcare.in/terms.html", icon: "document-text-outline" },
          { label: "Data Safety", sub: "What data is collected and why", url: "https://pillcare.in/data-safety.html", icon: "eye-outline" },
          { label: "Delete my account", sub: "Request permanent deletion of all your data", url: "https://pillcare.in/delete-account.html", icon: "trash-outline" },
        ].map((item) => (
          <TouchableOpacity key={item.url} style={s.card} onPress={() => Linking.openURL(item.url)}>
            <View style={s.cRow}>
              <View style={s.cIco}><Ionicons name={item.icon as any} size={17} color={A3} /></View>
              <View style={{ flex: 1 }}><Text style={s.cT}>{item.label}</Text><Text style={s.cS}>{item.sub}</Text></View>
              <Ionicons name="open-outline" size={13} color={TM} />
            </View>
          </TouchableOpacity>
        ))}

        {/* FAQs */}
        <Text style={s.secL} onPress={() => track("faq_opened")}>FREQUENTLY ASKED</Text>
        {faqs.map((f, i) => (
          <TouchableOpacity key={i} style={s.card} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[s.cT, { flex: 1, paddingRight: 8 }]}>{f.q}</Text>
              <Ionicons name={openFaq === i ? "chevron-down" : "chevron-forward"} size={13} color={TM} />
            </View>
            {openFaq === i && (
              <Text style={[s.cS, { marginTop: 6, lineHeight: 17 }]}>{f.a}</Text>
            )}
          </TouchableOpacity>
        ))}

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
