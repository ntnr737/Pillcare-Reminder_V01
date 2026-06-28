import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";
import { Card, PrimaryButton } from "@/src/components/PrimaryButton";
import { api } from "@/src/lib/api";

export default function BrandGeneric() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!brand.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await api.resolveGeneric(brand.trim());
      setResult(r.generic || "unknown");
    } catch (e: any) {
      setResult("Error: " + String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-from-bg">
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Brand → Generic</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Type a brand name to find its generic / international name.</Text>

        <TextInput
          testID="brand-input"
          value={brand}
          onChangeText={setBrand}
          placeholder="e.g. Crocin, Calpol, Saridon"
          placeholderTextColor={theme.colors.textDisabled}
          style={styles.input}
          autoCapitalize="words"
        />
        <View style={{ height: 12 }} />
        <PrimaryButton label={loading ? "Looking up…" : "Resolve"} onPress={lookup} loading={loading} testID="resolve-btn" />

        {result && (
          <Card style={{ marginTop: 16 }} testID="generic-result">
            <Text style={styles.label}>Brand</Text>
            <Text style={styles.value}>{brand}</Text>
            <Text style={[styles.label, { marginTop: 12 }]}>Generic</Text>
            <Text style={styles.generic}>{result}</Text>
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
  sub: { color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 22 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, padding: 16, color: theme.colors.textPrimary, fontSize: 18, minHeight: 56 },
  label: { color: theme.colors.textSecondary, fontSize: 12 },
  value: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 4 },
  generic: { color: theme.colors.brand, fontSize: 22, fontWeight: "700", marginTop: 4, textTransform: "capitalize" },
});
