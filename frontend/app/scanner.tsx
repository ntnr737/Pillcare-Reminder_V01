import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

export default function Scanner() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      setImage(r.assets[0].uri);
      setB64(r.assets[0].base64 || null);
      setResult(null);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      setImage(r.assets[0].uri);
      setB64(r.assets[0].base64 || null);
      setResult(null);
    }
  };

  const scan = async () => {
    if (!b64) return;
    setLoading(true);
    try {
      const res = await api.scanMedication(b64);
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity testID="back-from-scanner" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>AI Medication Scanner</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ alignItems: "center" }}>
          {image ? (
            <Image source={{ uri: image }} style={styles.img} resizeMode="cover" testID="scanner-preview" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.placeholderText}>Snap a photo of the pill, blister or packaging.</Text>
            </View>
          )}
          <View style={styles.btnRow}>
            <PrimaryButton label="Camera" onPress={pickFromCamera} variant="secondary" testID="scanner-camera-btn" style={{ flex: 1 }} />
            <View style={{ width: 8 }} />
            <PrimaryButton label="Gallery" onPress={pickFromGallery} variant="ghost" testID="scanner-gallery-btn" style={{ flex: 1 }} />
          </View>
          {image && (
            <View style={{ width: "100%", marginTop: 12 }}>
              <PrimaryButton label={loading ? "Scanning…" : "Identify"} onPress={scan} loading={loading} testID="scan-identify-btn" />
            </View>
          )}
        </Card>

        {result && !result.error && (
          <Card style={{ marginTop: 16 }} testID="scan-result-card">
            <Text style={styles.resultH}>Result</Text>
            <Text style={styles.resultLine}>Name: <Text style={styles.bold}>{result.name || "unknown"}</Text></Text>
            {result.dosage && <Text style={styles.resultLine}>Dosage: <Text style={styles.bold}>{result.dosage} {result.unit || ""}</Text></Text>}
            <Text style={styles.resultLine}>Confidence: <Text style={styles.bold}>{result.confidence || "n/a"}</Text></Text>
            <Text style={styles.tip}>Always verify with packaging or your pharmacist.</Text>
          </Card>
        )}
        {result?.error && (
          <Card style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.error }}>{result.error}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  body: { padding: 16 },
  img: { width: "100%", height: 240, borderRadius: 12 },
  placeholder: { width: "100%", height: 240, borderRadius: 12, backgroundColor: theme.colors.surfaceElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.borderSubtle, borderStyle: "dashed" },
  placeholderText: { color: theme.colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 24 },
  btnRow: { flexDirection: "row", marginTop: 16, width: "100%" },
  resultH: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  resultLine: { color: theme.colors.textSecondary, marginTop: 4, fontSize: 14 },
  bold: { color: theme.colors.textPrimary, fontWeight: "700" },
  tip: { color: theme.colors.textDisabled, fontSize: 12, marginTop: 12 },
});
