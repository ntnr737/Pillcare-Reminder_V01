import { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking, Alert, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { signOut, getStoredUser, isGuestUser, PillcareUser } from "@/src/lib/auth";
import { HeaderControls } from "@/src/components/HeaderControls";
import { api } from "@/src/lib/api";
import { track } from "@/src/lib/analytics";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";

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
    body: "PillCare complies with India's Digital Personal Data Protection Act 2023 (DPDP Act). We collect your health data only with your explicit consent, use it only for the purposes stated, and allow you to access, correct or delete it at any time.",
  },
  {
    icon: "server-outline",
    title: "What we collect",
    body: "Medication names, doses, schedules and intake records. Basic profile info (name, birth year, gender) for personalised reminders.",
  },
  {
    icon: "ban-outline",
    title: "What we never do",
    body: "We never sell your health data to anyone. We never share it with advertisers. We never show your medication list to anyone except you and caregivers you explicitly connect.",
  },
  {
    icon: "lock-closed-outline",
    title: "End-to-end encryption",
    body: "Your data is protected with bank-grade 256-bit encryption in transit and at rest. It is stored on certified enterprise cloud infrastructure.",
  },
];

const FAQS = [
  { q: "How do I add a new medication?", a: "Tap Treatment → Add Medication (+). Enter the brand name and set your dose and scheduled times." },
  { q: "Can I set multiple reminders for one medicine?", a: "Yes. When adding a medication, you can set multiple times (morning, afternoon, evening)." },
  { q: "How does the caregiver WhatsApp alert work?", a: "Enter your caregiver's phone number under Caregiver & Family. If you miss a dose, an automatic alert is dispatched." },
  { q: "How do I log my blood pressure or glucose?", a: "Go to Treatment → Measurements tab → tap Blood Pressure or Glucose → enter your reading." },
  { q: "Is my data stored securely?", a: "Yes. Your data is encrypted with 256-bit encryption in transit and at rest." },
];

type EmStatus = "idle" | "locating" | "ready" | "error";

export default function Support() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [user, setUser] = useState<PillcareUser | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emStatus, setEmStatus] = useState<EmStatus>("idle");
  const [emPlace, setEmPlace] = useState("");
  const [emNumber, setEmNumber] = useState("");
  const [emLabel, setEmLabel] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [caregiverConnected, setCaregiverConnected] = useState(false);
  const [savingCg, setSavingCg] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const loadAuthUser = async () => {
    try {
      const u = await getStoredUser();
      if (isMounted.current) {
        setUser(u);
        setIsGuest(isGuestUser(u));
      }
    } catch {
      if (isMounted.current) setIsGuest(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAuthUser();
    }, [])
  );

  useEffect(() => {
    loadAuthUser();
    api.getProfile().then(p => {
      if (p?.caregiver_phone) {
        setCaregiverConnected(true);
        setCaregiverPhone(p.caregiver_phone);
      }
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
      setCaregiverConnected(true);
      Alert.alert(t("common.save", "Saved"), "Caregiver phone connected successfully!");
    } catch {
      Alert.alert(t("common.error", "Error"), "Could not save caregiver number. Please try again.");
    } finally { setSavingCg(false); }
  };

  const handleCallDoctor = async () => {
    try {
      const appts = await api.listAppointments();
      const today = new Date().toISOString().slice(0, 10);
      const withPhone = (appts || []).filter((a: any) => a.phone);
      const target = withPhone[0];
      if (target) {
        Linking.openURL(`tel:${String(target.phone).replace(/[\s\-()]/g, "")}`);
      } else {
        Alert.alert("No doctor number saved", "Add a doctor's phone number to an appointment to call them directly.", [
          { text: t("common.cancel", "Cancel"), style: "cancel" },
          { text: "Add Appointment", onPress: () => router.push("/appointments") },
        ]);
      }
    } catch {
      Alert.alert(t("common.error", "Error"), "Could not load appointments.");
    }
  };

  const faqs = FAQS.filter(f => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      {/* Top Header Bar with Support Title & HeaderControls on Top Right */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8, gap: 2 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            {t("support.title", "Support & Settings")}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
            {t("support.subtitle", "Get help, customize theme & app preferences")}
          </Text>
        </View>

        {/* Theme Toggle & Language Selector in Top Right */}
        <HeaderControls />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchW, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginLeft: 12 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("common.search", "Search for help...")}
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchI, { color: theme.textPrimary }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={[styles.qCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={handleCallDoctor}
          >
            <View style={[styles.qIco, { backgroundColor: theme.accentBg }]}>
              <Ionicons name="call-outline" size={16} color={theme.accent} />
            </View>
            <Text style={[styles.qLbl, { color: theme.textPrimary }]}>{t("support.callDoctor", "Call Doctor")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.qCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => router.push("/appointments")}
          >
            <View style={[styles.qIco, { backgroundColor: theme.accentBg }]}>
              <Ionicons name="calendar-outline" size={16} color={theme.accent} />
            </View>
            <Text style={[styles.qLbl, { color: theme.textPrimary }]}>{t("support.bookAppointment", "Book Appointment")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.qCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={openEmergency}
          >
            <View style={[styles.qIco, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Ionicons name="medkit-outline" size={16} color={theme.alert} />
            </View>
            <Text style={[styles.qLbl, { color: theme.alert }]}>{t("support.emergency", "Emergency")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.qCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => router.push("/profile")}
          >
            <View style={[styles.qIco, { backgroundColor: theme.accentBg }]}>
              <Ionicons name="person-outline" size={16} color={theme.accent} />
            </View>
            <Text style={[styles.qLbl, { color: theme.textPrimary }]}>{t("support.myProfile", "My Profile")}</Text>
          </TouchableOpacity>
        </View>

        {/* Caregiver & WhatsApp Alerts */}
        <Text style={[styles.secL, { color: theme.textSecondary }]}>CAREGIVER & ALERTS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[styles.cIco, { backgroundColor: "rgba(16,185,129,0.14)" }]}>
              <Ionicons name="logo-whatsapp" size={18} color={theme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cT, { color: theme.textPrimary }]}>Connect Caregiver WhatsApp</Text>
              <Text style={[styles.cD, { color: theme.textSecondary }]}>Send automated alerts if medication doses are missed.</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TextInput
              value={caregiverPhone}
              onChangeText={setCaregiverPhone}
              placeholder="+919876543210"
              placeholderTextColor={theme.textDisabled}
              keyboardType="phone-pad"
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: theme.surfaceBorder,
                  color: theme.textPrimary,
                },
              ]}
            />
            <TouchableOpacity
              onPress={saveCaregiverPhone}
              disabled={savingCg}
              style={[styles.saveBtn, { backgroundColor: theme.accent }]}
            >
              {savingCg ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFF" }}>{t("common.save", "Save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Help Center FAQs */}
        <Text style={[styles.secL, { color: theme.textSecondary }]}>{t("support.helpCenter", "Help Center & FAQs")}</Text>
        {faqs.map((f, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.faqCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => setOpenFaq(openFaq === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.faqQ, { color: theme.textPrimary }]}>{f.q}</Text>
              <Ionicons name={openFaq === i ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
            </View>
            {openFaq === i && (
              <Text style={[styles.faqA, { color: theme.textSecondary }]}>{f.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Privacy & Safety */}
        <Text style={[styles.secL, { color: theme.textSecondary }]}>{t("support.privacyPolicy", "DPDP Privacy Policy & Safety")}</Text>
        {PRIVACY_SECTIONS.map((p, i) => (
          <View key={i} style={[styles.pCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Ionicons name={p.icon as any} size={16} color={theme.accent} />
              <Text style={[styles.pT, { color: theme.textPrimary }]}>{p.title}</Text>
            </View>
            <Text style={[styles.pB, { color: theme.textSecondary }]}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Emergency Modal */}
      <Modal visible={emergencyOpen} transparent animationType="fade" onRequestClose={() => setEmergencyOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="warning" size={36} color={theme.alert} style={{ alignSelf: "center" }} />
            <Text style={[styles.mTitle, { color: theme.textPrimary }]}>Emergency Helpline</Text>
            <Text style={[styles.mDesc, { color: theme.textSecondary }]}>Location: {emPlace}</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: theme.alert, textAlign: "center", marginVertical: 10 }}>
              {emNumber || "112"}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: "center", marginBottom: 16 }}>
              {emLabel}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.mBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", flex: 1 }]}
                onPress={() => setEmergencyOpen(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary, textAlign: "center" }}>{t("common.cancel", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mBtn, { backgroundColor: theme.alert, flex: 1 }]}
                onPress={() => {
                  setEmergencyOpen(false);
                  Linking.openURL(`tel:${emNumber || "112"}`);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFF", textAlign: "center" }}>Call Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "800" },
  searchW: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
  },
  searchI: { flex: 1, paddingHorizontal: 10, fontSize: 13 },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  qCard: {
    width: "48%",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qIco: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qLbl: { fontSize: 12, fontWeight: "700" },
  secL: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  cIco: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 14, fontWeight: "700" },
  cD: { fontSize: 12, marginTop: 2 },
  input: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 13 },
  saveBtn: { paddingHorizontal: 16, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  faqCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  faqQ: { fontSize: 13, fontWeight: "700", flex: 1, paddingRight: 8 },
  faqA: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  pCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  pT: { fontSize: 13, fontWeight: "700" },
  pB: { fontSize: 12, lineHeight: 18 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", padding: 20, borderRadius: 20, borderWidth: 1 },
  mTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  mDesc: { fontSize: 12, textAlign: "center", marginTop: 2 },
  mBtn: { height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
});
