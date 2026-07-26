import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api } from "@/src/lib/api";
import { getStoredUser } from "@/src/lib/auth";
import { set, K } from "@/src/lib/store";

const BG = "#161826", SF = "#232532", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const CY = new Date().getFullYear();

const FEATURES = [
  { icon: "notifications-outline", title: "Smart Reminders", body: "Sound alerts at your scheduled times, never missed." },
  { icon: "people-outline", title: "Family Alerts", body: "Caregiver gets a WhatsApp summary if you miss a dose." },
  { icon: "body-outline", title: "Yoga & Wellness", body: "Personalised yoga routine based on your medications." },
  { icon: "bar-chart-outline", title: "Health Insights", body: "Weekly adherence charts and AI-powered daily tips." },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState(GENDERS[0]);
  const [yob, setYob] = useState(String(CY - 30));
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [cityState, setCityState] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const TOTAL = 3;

  // Pre-fill from Google account
  useEffect(() => {
    getStoredUser().then(u => {
      if (u?.name && !nickname) setNickname(u.name);
      if (u?.email && !email) setEmail(u.email);
    });
  }, []);

  // Auto-detect location on step 0
  useEffect(() => {
    if (step === 0 && !city) fetchGPS();
  }, [step]);

  const fetchGPS = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo.length > 0) { setCity(geo[0].city || geo[0].subregion || ""); setCityState(geo[0].region || ""); }
    } catch {}
    finally { setLocLoading(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const profile = {
        nickname: nickname.trim() || "Friend",
        email: email.trim() || undefined,
        gender,
        year_of_birth: parseInt(yob) || CY - 30,
        location_city: city.trim() || undefined,
        location_state: cityState.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      await api.upsertProfile(profile);
      set(K.profile, profile);
      router.replace("/(tabs)/today");
    } catch (e) { console.warn(e); }
    finally { setSaving(false); }
  };

  const canNext = step === 0 ? nickname.trim().length > 0 && yob.length === 4 : true;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Progress dots */}
      <View style={s.progress}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotOn]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Tell us about you ── */}
        {step === 0 && (
          <View>
            <Text style={s.stepTag}>Step 1 of 3</Text>
            <Text style={s.h1}>Tell us about you</Text>
            <Text style={s.sub}>We'll use this to personalise your reminders and care plan.</Text>

            <Text style={s.label}>Full name *</Text>
            <TextInput value={nickname} onChangeText={setNickname}
              placeholder="e.g. Nitin" placeholderTextColor={TM}
              style={s.input} autoFocus />
            <Text style={s.hint}>Pre-filled from your Google account — feel free to change.</Text>

            <Text style={s.label}>Email</Text>
            <View style={[s.input, { flexDirection: "row", alignItems: "center" }]}>
              <Text style={{ color: email ? TX : TM, fontSize: 15, flex: 1 }}>{email || "From your Google account"}</Text>
              <Ionicons name="checkmark-circle" size={16} color={email ? A3 : "rgba(233,233,237,0.2)"} />
            </View>

            <Text style={s.label}>Birth year *</Text>
            <TextInput value={yob} onChangeText={v => setYob(v.replace(/[^0-9]/g, "").slice(0, 4))}
              keyboardType="number-pad" placeholder="e.g. 1990" placeholderTextColor={TM}
              style={s.input} />
            <Text style={s.hint}>Year only — we never ask for your full date of birth.</Text>

            <Text style={s.label}>Gender *</Text>
            <View style={s.chipRow}>
              {GENDERS.map(g => (
                <TouchableOpacity key={g} onPress={() => setGender(g)} style={[s.chip, gender === g && s.chipOn]}>
                  <Text style={[s.chipTx, gender === g && s.chipTxOn]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.hintSmall}>Required so we can tailor dosage reminders and health tips to you.</Text>

            <Text style={s.label}>Phone <Text style={{ fontWeight: "400", fontStyle: "italic", color: TM }}>(optional)</Text></Text>
            <TextInput value={phone} onChangeText={setPhone}
              keyboardType="phone-pad" placeholder="+91 XXXXX XXXXX" placeholderTextColor={TM}
              style={s.input} />

            {/* Location — detected silently */}
            {city ? (
              <View style={s.locCard}>
                <Ionicons name="location" size={16} color={A3} />
                <Text style={s.locTx}>{city}{cityState ? `, ${cityState}` : ""}</Text>
                <Text style={[s.hint, { flex: 1, textAlign: "right", marginTop: 0 }]}>auto-detected</Text>
              </View>
            ) : locLoading ? (
              <View style={s.locCard}>
                <ActivityIndicator size="small" color={A3} />
                <Text style={s.locTx}>Detecting your location…</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── STEP 2: Here's what PillCare offers ── */}
        {step === 1 && (
          <View>
            <Text style={s.stepTag}>Step 2 of 3</Text>
            <Text style={s.h1}>Here's what{"\n"}PillCare offers</Text>
            <Text style={s.sub}>Using the details you shared, we've set up a personalised care experience across four areas.</Text>

            <View style={{ gap: 10, marginTop: 8 }}>
              {FEATURES.map(f => (
                <View key={f.title} style={s.feCard}>
                  <View style={s.feIco}><Ionicons name={f.icon as any} size={18} color={A3} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feTitle}>{f.title}</Text>
                    <Text style={s.feBody}>{f.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[s.locCard, { marginTop: 20 }]}>
              <Ionicons name="lock-closed-outline" size={14} color={A3} />
              <Text style={[s.hint, { marginTop: 0, flex: 1 }]}>Your data is safe and secure with us.</Text>
            </View>
          </View>
        )}

        {/* ── STEP 3: Confirm & start ── */}
        {step === 2 && (
          <View>
            <Text style={s.stepTag}>Step 3 of 3</Text>
            <Text style={s.h1}>You're all set,{"\n"}{nickname || "Friend"}!</Text>
            <Text style={s.sub}>Here's a summary of your profile. You can update anything in Settings later.</Text>

            <View style={{ gap: 10, marginTop: 8 }}>
              {[
                { icon: "person-outline", label: "Name", value: nickname || "—" },
                { icon: "mail-outline", label: "Email", value: email || "—" },
                { icon: "calendar-outline", label: "Birth Year", value: yob },
                { icon: "people-outline", label: "Gender", value: gender },
                { icon: "location-outline", label: "Location", value: city ? `${city}${cityState ? `, ${cityState}` : ""}` : "Not set" },
                { icon: "call-outline", label: "Phone", value: phone || "Not set" },
              ].map(r => (
                <View key={r.label} style={[s.feCard, { paddingVertical: 10 }]}>
                  <View style={s.feIco}><Ionicons name={r.icon as any} size={16} color={A3} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.hint, { marginTop: 0 }]}>{r.label}</Text>
                    <Text style={s.feTitle}>{r.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View style={s.footer}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {step > 0 && (
            <TouchableOpacity style={[s.btn, { flex: 0.4, backgroundColor: "rgba(233,233,237,0.08)" }]} onPress={() => setStep(s => s - 1)}>
              <Text style={[s.btnTx, { color: TM }]}>Back</Text>
            </TouchableOpacity>
          )}
          {step < TOTAL - 1 ? (
            <TouchableOpacity style={[s.btn, { flex: 1, opacity: canNext ? 1 : 0.4 }]} onPress={() => canNext && setStep(s => s + 1)} disabled={!canNext}>
              <Text style={s.btnTx}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>Get Started →</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  progress: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(233,233,237,0.12)" },
  dotOn: { backgroundColor: AC },
  body: { padding: 24, paddingBottom: 32 },
  stepTag: { fontSize: 11, color: A3, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontSize: 28, fontWeight: "700", color: TX, marginBottom: 8, letterSpacing: -0.5, lineHeight: 34 },
  sub: { fontSize: 14, color: TM, marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, color: TM, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 11, color: TM, marginTop: 4, fontStyle: "italic" },
  hintSmall: { fontSize: 11, color: TM, marginTop: 6 },
  input: { backgroundColor: SF, borderRadius: 12, padding: 14, color: TX, fontSize: 15, borderWidth: 1, borderColor: BD, minHeight: 50 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: 999, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: AB, borderColor: AC },
  chipTx: { color: TM, fontWeight: "600", fontSize: 13 },
  chipTxOn: { color: A3 },
  locCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: SF, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: BD, marginTop: 12 },
  locTx: { color: TX, fontSize: 13, fontWeight: "600", flex: 1 },
  feCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: SF, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BD },
  feIco: { width: 38, height: 38, borderRadius: 19, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  feTitle: { fontSize: 14, fontWeight: "700", color: TX, marginBottom: 2 },
  feBody: { fontSize: 12, color: TM, lineHeight: 16 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: BD },
  btn: { backgroundColor: AC, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center" },
  btnTx: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
