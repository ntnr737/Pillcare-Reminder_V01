import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { getStoredToken } from "@/src/lib/auth";
import { get, K } from "@/src/lib/store";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getStoredToken();
        if (!token) {
          if (mounted) setTarget("/sign-in");
          return;
        }
        const cached = await get<any>(K.profile);
        if (!mounted) return;
        if (cached?.nickname) {
          setTarget("/(tabs)/today");
        } else {
          setTarget("/onboarding");
        }
      } catch {
        if (mounted) setTarget("/sign-in");
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (target) {
    return <Redirect href={target as any} />;
  }

  return (
    <View style={s.c}>
      <ActivityIndicator size="large" color={theme.colors.brand} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" },
});
