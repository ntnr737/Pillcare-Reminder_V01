import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    api.getProfile()
      .then((p) => {
        if (!mounted) return;
        if (p && p.nickname) router.replace("/(tabs)/today");
        else router.replace("/onboarding");
      })
      .catch(() => {
        if (mounted) router.replace("/onboarding");
      });
    return () => { mounted = false; };
  }, [router]);

  return (
    <View style={styles.c} testID="splash-screen">
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" },
});
