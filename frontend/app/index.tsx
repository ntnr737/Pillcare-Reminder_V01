import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getStoredToken } from "@/src/lib/auth";
import { get, K } from "@/src/lib/store";
import { theme } from "@/src/lib/theme";

/**
 * Startup redirect — must be INSTANT.
 * We NEVER hit the server here. Server calls happen inside Today screen.
 *
 * Logic:
 * 1. No token → sign-in
 * 2. Token + cached profile with nickname → today (instant)
 * 3. Token + no cached profile → onboarding
 * Background profile fetch happens inside Today/Onboarding screens.
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Step 1: check local token — AsyncStorage only, no server
      const token = await getStoredToken();
      if (!token) {
        if (mounted) router.replace("/sign-in");
        return;
      }
      // Step 2: check local profile cache — no server call
      const cached = await get<any>(K.profile);
      if (!mounted) return;
      if (cached?.nickname) {
        router.replace("/(tabs)/today");
      } else {
        router.replace("/onboarding");
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  return (
    <View style={s.c}>
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" },
});
