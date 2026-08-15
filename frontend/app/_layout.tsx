import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { initAnalytics } from "@/src/lib/firebase";
import { resyncReminders, registerForPushNotifications } from "@/src/lib/notifications";
import { loadCachedFeatures, fetchFeatures } from "@/src/lib/features";
import { getStoredToken } from "@/src/lib/auth";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    initAnalytics().catch(() => {});
    resyncReminders().catch(() => {});
    registerForPushNotifications().catch(() => {});
    loadCachedFeatures().catch(() => {});
    getStoredToken().then((token) => { if (token) fetchFeatures(token).catch(() => {}); }).catch(() => {});
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#121413" }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#121413" } }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
