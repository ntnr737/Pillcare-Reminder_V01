import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", A3 = "#a7a1db", BD = "rgba(233,233,237,0.1)";

const SECTIONS = [
  {
    title: "1. Who We Are",
    body: "PillCare Reminder is a medication management application. By using this app, you agree to the collection and use of information as described in this Privacy Policy.",
  },
  {
    title: "2. Information We Collect",
    body: "We collect:\n• Your name, email address and profile photo from Google Sign-In\n• Year of birth, gender, and city/state (for personalised reminders)\n• Medication names, dosages, schedules and intake records\n• Health measurements (blood pressure, glucose, weight, SpO2)\n• Physical activities (steps, exercise type, duration)\n• Mood scores and optional notes\n• Doctor appointment details\n• Optional caregiver phone number for WhatsApp alerts\n\nWe do NOT collect your full date of birth, exact GPS coordinates, or any financial information.",
  },
  {
    title: "3. How We Use Your Information",
    body: "We use your information to:\n• Send medication reminders at your scheduled times\n• Generate AI-powered health insights and yoga recommendations\n• Send missed-dose alerts to your designated caregiver via WhatsApp\n• Calculate your adherence streaks and progress reports\n• Resolve brand medication names to generic equivalents\n• Personalise your experience based on your routine",
  },
  {
    title: "4. Data Storage and Security",
    body: "Your data is protected with 256-bit encryption in transit and at rest, hosted on certified enterprise cloud infrastructure with global security standards and redundancy. Access requires your authenticated account. Our team cannot access your health records without your explicit permission.",
  },
  {
    title: "5. Third-Party Services",
    body: "We share data with the following third parties solely to provide app functionality:\n\n• Google (Sign-In authentication) — google.com/privacy\n• Groq AI (AI insight generation and drug name processing) — groq.com/privacy. Your medication names and adherence data may be sent to Groq to generate personalised messages. No personally identifiable information is included.\n• WasenderAPI (WhatsApp caregiver alerts) — only your caregiver's phone number and a summary message are sent.\n• OpenFDA (drug name lookup) — no personal data is sent; only medication brand names.\n\nWe do not sell, rent, or trade your personal or health data to any third party for advertising or commercial purposes.",
  },
  {
    title: "6. Data Retention",
    body: "We retain your data for as long as your account is active. You may delete individual entries or request complete account deletion at any time from within the app (Support → Delete Account) or by emailing support@pillcare.app. We will delete all your data within 30 days of your request.",
  },
  {
    title: "7. Your Rights",
    body: "You have the right to:\n• Access all data we hold about you (use CSV export in the app)\n• Correct inaccurate data (edit via app settings)\n• Delete your data at any time\n• Withdraw consent for AI processing (disable AI features in settings)\n• Lodge a complaint with your local data protection authority",
  },
  {
    title: "8. Children's Privacy",
    body: "PillCare Reminder is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us immediately.",
  },
  {
    title: "9. Medical Disclaimer",
    body: "PillCare Reminder is NOT a medical device and does not diagnose, treat, cure, or prevent any disease or health condition. The app is a reminder and tracking tool only. Always consult a qualified healthcare professional before making any changes to your medication or treatment plan. AI-generated content including yoga recommendations, drug information, and health insights are for informational purposes only and should not replace professional medical advice.",
  },
  {
    title: "10. Prescription Scanner Disclaimer",
    body: "The prescription photo scanner uses AI to read medication information from images. Accuracy is not guaranteed. Always verify scanned information with your pharmacist or prescribing doctor before adding any medication to your schedule.",
  },
  {
    title: "11. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes via the app. Continued use of the app after changes constitutes acceptance of the updated policy.",
  },
  {
    title: "12. Contact Us",
    body: "For privacy questions, data requests, or to report a concern:\nEmail: support@pillcare.app\n\nWe will respond within 5 business days.",
  },
];

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.hdr}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/today");
            }
          }}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={TX} />
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.lastUpdated}>Last updated: July 2026</Text>
        <Text style={s.intro}>
          PillCare Reminder is committed to protecting your health data. This policy explains what we collect, how we use it, and your rights.
        </Text>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.secTitle}>{sec.title}</Text>
            <Text style={s.secBody}>{sec.body}</Text>
          </View>
        ))}
        <View style={s.footer}>
          <Ionicons name="lock-closed-outline" size={13} color={A3} />
          <Text style={s.footerTx}>Your health data is yours. Always.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BD },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: TX },
  body: { padding: 20, paddingBottom: 40, gap: 20 },
  lastUpdated: { fontSize: 11, color: TM, textAlign: "center" },
  intro: { fontSize: 13, color: TM, lineHeight: 20, backgroundColor: SF, borderRadius: 12, padding: 14 },
  section: { gap: 8 },
  secTitle: { fontSize: 13, fontWeight: "700", color: A3 },
  secBody: { fontSize: 12, color: TM, lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 8 },
  footerTx: { fontSize: 11, color: TM },
});
