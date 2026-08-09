import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export default function BookAppointment() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("General physician");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState("1_day");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/appointments`);
      const data = await res.json();
      setAppointments(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTime = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const saveAppointment = async () => {
    if (!doctorName.trim()) {
      Alert.alert("Error", "Please enter doctor name");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter phone number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_name: doctorName.trim(),
          specialty: specialty,
          phone: phone.trim(),
          date: formatDate(date),
          time: formatTime(time),
          notes: notes.trim() || undefined,
          reminder: reminder,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      // Reset form
      setDoctorName("");
      setSpecialty("General physician");
      setPhone("");
      setDate(new Date());
      setTime(new Date());
      setNotes("");
      setReminder("1_day");

      load();
      Alert.alert("Success", "Appointment booked successfully!");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Could not save appointment");
    } finally {
      setSaving(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/appointments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      load();
    } catch (e) {
      Alert.alert("Error", "Could not delete appointment");
    }
  };

  const confirmDelete = (id: string, doctorName: string) => {
    Alert.alert(
      "Delete Appointment",
      `Delete appointment with ${doctorName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteAppointment(id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Book Appointment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>New Appointment</Text>

          <Text style={styles.label}>Doctor Name *</Text>
          <TextInput
            testID="doctor-name-input"
            value={doctorName}
            onChangeText={setDoctorName}
            placeholder="Dr. John Smith"
            placeholderTextColor={theme.colors.textDisabled}
            style={styles.input}
          />

          <Text style={styles.label}>Specialty</Text>
          <TextInput
            testID="specialty-input"
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="General physician"
            placeholderTextColor={theme.colors.textDisabled}
            style={styles.input}
          />

          <Text style={styles.label}>Phone (for calling) *</Text>
          <TextInput
            testID="phone-input"
            value={phone}
            onChangeText={setPhone}
            placeholder="1234567890"
            placeholderTextColor={theme.colors.textDisabled}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity testID="date-picker-btn" onPress={() => setShowDatePicker(true)} style={styles.input}>
            <Text style={styles.inputText}>{formatDate(date)}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Time *</Text>
          <TouchableOpacity testID="time-picker-btn" onPress={() => setShowTimePicker(true)} style={styles.input}>
            <Text style={styles.inputText}>{formatTime(time)}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            testID="notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Bring reports, fasting required..."
            placeholderTextColor={theme.colors.textDisabled}
            style={[styles.input, { height: 80 }]}
            multiline
          />

          <Text style={styles.label}>Reminder</Text>
          <View style={styles.reminderRow}>
            {[
              { key: "1_day", label: "1 Day before" },
              { key: "2_hours", label: "2 Hours before" },
              { key: "none", label: "No reminder" },
            ].map((r) => (
              <TouchableOpacity
                key={r.key}
                testID={`reminder-${r.key}`}
                onPress={() => setReminder(r.key)}
                style={[styles.reminderChip, reminder === r.key && styles.reminderChipActive]}
              >
                <Text style={[styles.reminderText, reminder === r.key && styles.reminderTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <PrimaryButton
            label={saving ? "Saving..." : "Book Appointment"}
            onPress={saveAppointment}
            loading={saving}
            testID="book-btn"
            style={{ marginTop: 16 }}
          />
        </Card>

        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
        {appointments.filter((a) => a.status === "scheduled").length === 0 && (
          <Card>
            <Text style={styles.empty}>No appointments scheduled.</Text>
          </Card>
        )}
        {appointments
          .filter((a) => a.status === "scheduled")
          .map((a) => (
            <Card key={a.id} style={{ marginBottom: 12 }} testID={`appointment-${a.id}`}>
              <View style={styles.apptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{a.doctor_name}</Text>
                  <Text style={styles.specialty}>{a.specialty}</Text>
                  <Text style={styles.dateTime}>
                    {a.date} at {a.time}
                  </Text>
                  {!!a.notes && <Text style={styles.notes}>{a.notes}</Text>}
                  <Text style={styles.phone}>📞 {a.phone}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(a.id, a.doctor_name)}
                  testID={`delete-${a.id}`}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setTime(selectedTime);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  body: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    minHeight: 48,
  },
  inputText: { color: theme.colors.textPrimary, fontSize: 16 },
  reminderRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  reminderChipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  reminderText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  reminderTextActive: { color: theme.colors.textInverse },
  empty: { color: theme.colors.textSecondary, padding: 8 },
  apptRow: { flexDirection: "row", alignItems: "flex-start" },
  doctorName: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  specialty: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  dateTime: {
    color: theme.colors.brand,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  notes: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    fontStyle: "italic",
  },
  phone: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 8,
  },
});
