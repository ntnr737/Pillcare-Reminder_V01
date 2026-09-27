import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, AppState, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { initAnalytics } from "@/src/lib/firebase";
import {
  resyncReminders,
  registerForPushNotifications,
  setupNotificationListeners,
  addForegroundNotificationReceivedListener,
} from "@/src/lib/notifications";
import { loadCachedFeatures, fetchFeatures } from "@/src/lib/features";
import { getStoredToken } from "@/src/lib/auth";
import { api } from "@/src/lib/api";

import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import {
  InAppBottomNotification,
  InAppNotificationPayload,
} from "@/src/components/InAppBottomNotification";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { theme } = useTheme();
  const router = useRouter();
  const [inAppNotif, setInAppNotif] = useState<InAppNotificationPayload | null>(null);

  useEffect(() => {
    const unsub = addForegroundNotificationReceivedListener((notif) => {
      setInAppNotif({
        title: notif.title,
        body: notif.body,
        type: notif.type || "info",
        data: notif.data,
      });
    });
    return () => unsub();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack screenOptions={{ headerShown: false }} />
      <InAppBottomNotification
        notification={inAppNotif}
        onDismiss={() => setInAppNotif(null)}
        onPressAction={() => {
          if (inAppNotif?.data?.path) {
            try {
              router.push(inAppNotif.data.path as any);
            } catch {}
          }
        }}
      />
    </GestureHandlerRootView>
  );
}

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
    getStoredToken()
      .then((token) => {
        if (token) fetchFeatures(token).catch(() => {});
      })
      .catch(() => {});

    // Periodic heartbeat ping to sync active connectivity & Tag Manager dwell telemetry
    const sendHeartbeat = () => {
      getStoredToken().then((token) => {
        if (token) {
          api.heartbeatPing().catch(() => {});
        }
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);

    const unsubNotifs = setupNotificationListeners((path) => {
      try {
        router.push(path as any);
      } catch {}
    });
    return () => {
      clearInterval(interval);
      unsubNotifs();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        resyncReminders().catch(() => {});
        getStoredToken()
          .then((token) => {
            if (token) {
              fetchFeatures(token).catch(() => {});
              api.heartbeatPing().catch(() => {});
              api.trackEvent("app_open", { screen: "Home & Dosage Tracker" }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <RootStack />
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
