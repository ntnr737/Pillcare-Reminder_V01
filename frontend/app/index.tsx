import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { getStoredToken } from "@/src/lib/auth";
import { get, K } from "@/src/lib/store";
import { theme } from "@/src/lib/theme";

import * as Notifications from "expo-notifications";

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
        if (token || cached?.nickname || cached?.name || cached?.email) {
          // Check if cold-started by tapping a notification
          const initialResponse = await Notifications.getLastNotificationResponseAsync().catch(() => null);
          let dest = "/(tabs)/today";
          if (initialResponse) {
            const data = (initialResponse.notification.request.content.data || {}) as Record<string, any>;
            const routePath = data.path || data.routeKey || data.route_key || data.link_url;
            if (data.type === "yoga" || data.isYogaReminder || data.category === "yoga" || routePath === "/(tabs)/yoga") {
              dest = "/(tabs)/yoga";
            } else if (data.type === "water_reminder" || data.type === "water_pacing_reminder" || data.category === "water") {
              dest = "/(tabs)/today?focus=water";
            } else if (data.medicationId) {
              dest = `/(tabs)/today?focus=medication&medId=${data.medicationId}`;
            } else if (routePath && typeof routePath === "string" && routePath.startsWith("/")) {
              dest = routePath;
            }
          }
          setTarget(dest);
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
