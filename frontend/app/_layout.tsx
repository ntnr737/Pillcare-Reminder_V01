import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { Component, useEffect, useState } from "react";
import { LogBox, AppState, View, Text, TouchableOpacity } from "react-native";
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
import { loadCachedFeatures, fetchFeatures, getFeatures, onFeaturesChange } from "@/src/lib/features";
import { getStoredToken } from "@/src/lib/auth";
import { api } from "@/src/lib/api";

import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import {
  InAppBottomNotification,
  InAppNotificationPayload,
} from "@/src/components/InAppBottomNotification";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PillCareErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("PillCare ErrorBoundary Caught Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: "#0b0f19", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: "#f87171", marginBottom: 12 }}>PillCare Alert</Text>
          <Text style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 24 }}>
            An unexpected error occurred. Tap below to reload app.
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{ backgroundColor: "#9184d9", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "bold", fontSize: 16 }}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootStack() {
  const { theme } = useTheme();
  const router = useRouter();
  const [inAppNotif, setInAppNotif] = useState<InAppNotificationPayload | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(() => getFeatures().maintenance_mode === true);

  useEffect(() => {
    return onFeaturesChange((features) => setMaintenanceMode(features.maintenance_mode === true));
  }, []);

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

  if (maintenanceMode) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg, justifyContent: "center", alignItems: "center", padding: 28 }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 10 }}>PillCare is temporarily unavailable</Text>
        <Text style={{ color: "#94a3b8", fontSize: 14, lineHeight: 21, textAlign: "center" }}>
          We’re performing maintenance. Please try again shortly.
        </Text>
      </GestureHandlerRootView>
    );
  }

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

    // Periodic heartbeat ping to sync active connectivity
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
    <PillCareErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <RootStack />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </PillCareErrorBoundary>
  );
}
