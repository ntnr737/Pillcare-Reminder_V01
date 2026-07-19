import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { getStoredToken, signOut } from "@/src/lib/auth";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await getStoredToken();
      if (!token) {
        if (mounted) router.replace("/sign-in");
        return;
      }
      try {
        const p = await api.getProfile();
        if (!mounted) return;
        if (p && p.nickname) router.replace("/(tabs)/today");
        else router.replace("/onboarding");
      } catch (e: any) {
        if (String(e?.message || "").includes("401")) {
          await signOut();
        }
        if (mounted) router.replace("/sign-in");
      }
    })();
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
