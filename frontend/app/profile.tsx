import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useFocusEffect } from "expo-router";
import { get, set, K } from "@/src/lib/store";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const load = useCallback(async () => {
    const cached = await get<any>(K.profile);
    if (cached) setProfile(cached);
    try {
      const p = await api.getProfile();
      setProfile(p); set(K.profile, p);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = (key: string, val: any) => {
    setProfile((p: any) => ({ ...p, [key]: val }));
    setChanged(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.upsertProfile(profile);
      set(K.profile, profile);
      setChanged(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally { setSaving(false); }
  };

  const ROUTINE_OPTIONS = [
    { key: "routine_morning", label: "Morning", icon: "sunny-outline" },
    { key: "routine_afternoon", label: "Afternoon", icon: "partly-sunny-outline" },
    { key: "routine_evening", label: "Evening", icon: "moon-outline" },
    { key: "routine_night", label: "Night", icon: "star-outline" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={TX} />
        </TouchableOpacity>
        <Text style={s.title}>My Profile</Text>
        {changed ? (
          <TouchableOpacity onPress={save} disabled={saving}>
            <Text style={{ color: A3, fontWeight: "700", fontSize: 14 }}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 48 }} />}
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <Text style={s.secL}>IDENTITY</Text>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>Display Name</Text>
            <TextInput value={profile.nickname || ""} onChangeText={v => update("nickname", v)} placeholder="Your name" placeholderTextColor={TM} style={s.inp} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <Text style={[s.inp, { color: TM }]}>{profile.email || "—"}</Text>
          </View>
          <View style={s.field}>
            <Text style={s.label}>Gender</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["male", "female", "other", "prefer not to say"].map(g => (
                <TouchableOpacity key={g} onPress={() => update("gender", g)}
                  style={[s.chip, profile.gender === g && s.chipOn]}>
                  <Text style={[s.chipT, profile.gender === g && { color: A3 }]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.field}>
            <Text style={s.label}>Year of Birth</Text>
            <TextInput value={profile.year_of_birth ? String(profile.year_of_birth) : ""} onChangeText={v => update("year_of_birth", parseInt(v) || "")} placeholder="1990" placeholderTextColor={TM} style={s.inp} keyboardType="numeric" />
          </View>
        </View>

        {/* Location */}
        <Text style={s.secL}>LOCATION</Text>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>City</Text>
            <TextInput value={profile.location_city || ""} onChangeText={v => update("location_city", v)} placeholder="Mumbai" placeholderTextColor={TM} style={s.inp} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>State / Region</Text>
            <TextInput value={profile.location_state || ""} onChangeText={v => update("location_state", v)} placeholder="Maharashtra" placeholderTextColor={TM} style={s.inp} />
          </View>
        </View>

        {/* Contact */}
        <Text style={s.secL}>CONTACT</Text>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>Phone Number</Text>
            <TextInput value={profile.phone || ""} onChangeText={v => update("phone", v)} placeholder="+91 XXXXX XXXXX" placeholderTextColor={TM} style={s.inp} keyboardType="phone-pad" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Caregiver WhatsApp</Text>
            <TextInput value={profile.caregiver_phone || ""} onChangeText={v => update("caregiver_phone", v)} placeholder="+91 XXXXX XXXXX" placeholderTextColor={TM} style={s.inp} keyboardType="phone-pad" />
            <Text style={[s.label, { marginTop: 4, fontStyle: "italic" }]}>Receives missed-dose alerts via WhatsApp</Text>
            <TouchableOpacity onPress={() => router.push("/caregiver")} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Ionicons name="people-outline" size={13} color={A3} />
              <Text style={{ fontSize: 11, color: A3, fontWeight: "700" }}>Manage all caregivers & alert history</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Routine */}
        <Text style={s.secL}>MEDICATION ROUTINE</Text>
        <View style={s.card}>
          <Text style={s.label}>When do you typically take medications?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {ROUTINE_OPTIONS.map(r => (
              <TouchableOpacity key={r.key} onPress={() => update(r.key, !profile[r.key])}
                style={[s.routineBtn, profile[r.key] && s.routineBtnOn]}>
                <Ionicons name={r.icon as any} size={13} color={profile[r.key] ? A3 : TM} />
                <Text style={[s.chipT, profile[r.key] && { color: A3 }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <Text style={s.secL}>NOTIFICATIONS</Text>
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={s.cT}>Medication Reminders</Text>
              <Text style={s.cS}>Sound and vibration alerts</Text>
            </View>
            <Switch value={profile.notifications_enabled !== false} onValueChange={v => update("notifications_enabled", v)} trackColor={{ false: "#3e3e3e", true: AC }} thumbColor={TX} />
          </View>
        </View>

        {/* Save button */}
        {changed && (
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
            <Text style={s.saveTx}>{saving ? "Saving…" : "Save Profile"}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BD },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: TX },
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  secL: { fontSize: 10, letterSpacing: 1, color: TM, fontWeight: "700" },
  card: { backgroundColor: SF, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: BD },
  field: { gap: 6 },
  label: { fontSize: 10, color: TM, fontWeight: "600" },
  inp: { backgroundColor: "#1e2030", borderRadius: 10, padding: 12, color: TX, fontSize: 13, borderWidth: 1, borderColor: BD },
  cT: { fontSize: 13, fontWeight: "600", color: TX }, cS: { fontSize: 10, color: TM },
  chip: { paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: AB, borderColor: AC }, chipT: { fontSize: 11, color: TM, fontWeight: "600" },
  routineBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1, borderColor: BD },
  routineBtnOn: { backgroundColor: AB, borderColor: AC },
  saveBtn: { backgroundColor: AC, borderRadius: 12, padding: 14, alignItems: "center" },
  saveTx: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
