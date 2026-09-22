import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { initAnalytics } from "@/src/lib/firebase";
import { resyncReminders, registerForPushNotifications, setupNotificationListeners } from "@/src/lib/notifications";
import { loadCachedFeatures, fetchFeatures } from "@/src/lib/features";
import { getStoredToken } from "@/src/lib/auth";

import { ThemeProvider } from "@/src/context/ThemeContext";
import { LanguageProvider } from "@/src/context/LanguageContext";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();

  useEffect(() => {
    let timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 1500);

    if (loaded || error) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [loaded, error]);

  useEffect(() => {
    initAnalytics().catch(() => {});
    resyncReminders().catch(() => {});
    registerForPushNotifications().catch(() => {});
    loadCachedFeatures().catch(() => {});
    getStoredToken().then((token) => { if (token) fetchFeatures(token).catch(() => {}); }).catch(() => {});
    const unsubNotifs = setupNotificationListeners((path) => {
      try { router.push(path as any); } catch {}
    });
    return () => unsubNotifs();
  }, []);

  // Re-fetch plan/feature flags whenever the app comes back to the foreground —
  // otherwise a plan upgrade only takes effect after a full app restart.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        resyncReminders().catch(() => {});
        getStoredToken().then((token) => { if (token) fetchFeatures(token).catch(() => {}); }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0D14" }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
