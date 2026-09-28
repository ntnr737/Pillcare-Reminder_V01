import { Platform } from "react-native";
import { logEvent as fbLogEvent } from "./firebase";
import { api } from "./api";

// Google Tag Manager / GA4 Container Config
export const GTM_CONTAINER_ID = "GTM-P4CARE1";
export const GA4_MEASUREMENT_ID = "G-X8WF8SD4DF";

export interface AnalyticsEventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

/**
 * Universal event tracker: Dispatches events to Firebase GA4, GTM DataLayer, and PillCare Telemetry Backend.
 */
export async function trackEvent(eventName: string, params: AnalyticsEventParams = {}) {
  try {
    const enrichedParams = {
      ...params,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };

    // 1. Log to Firebase GA4
    fbLogEvent(eventName, enrichedParams).catch(() => {});

    // 2. Push to Web GTM DataLayer (if running on Web or WebBrowser)
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: eventName,
        ...enrichedParams,
      });
    }

    // 3. Post to PillCare Telemetry Backend API for Live Admin Dashboard
    api.postTelemetryEvent(eventName, enrichedParams).catch(() => {});
  } catch (err) {
    // Fail-safe silently to prevent breaking user workflow
  }
}

/**
 * Track Screen Views across tab navigation
 */
export function trackScreenView(screenName: string, previousScreen?: string) {
  trackEvent("screen_view", {
    screen_name: screenName,
    previous_screen: previousScreen || "none",
  });
}

/**
 * Track Specific Medication Doses
 */
export function trackDoseAction(medName: string, status: "taken" | "skipped", timeSlot?: string) {
  trackEvent("dose_action", {
    category: "treatment",
    medication_name: medName,
    status,
    time_slot: timeSlot || "scheduled",
  });
}

/**
 * Track Hydration Logs
 */
export function trackHydrationLog(amountMl: number, totalMl: number) {
  trackEvent("hydration_logged", {
    category: "wellness",
    amount_ml: amountMl,
    total_logged_ml: totalMl,
  });
}

/**
 * Track Yoga Sessions
 */
export function trackYogaSession(poseName: string, durationSecs: number, feeling?: string) {
  trackEvent("yoga_session_completed", {
    category: "yoga",
    pose_name: poseName,
    duration_seconds: durationSecs,
    feeling_rating: feeling || "good",
  });
}

/**
 * Track Subscription Funnel Interactions
 */
export function trackSubscriptionFunnel(step: "modal_view" | "plan_selected" | "checkout_complete", planName?: string) {
  trackEvent("subscription_funnel", {
    category: "revenue",
    funnel_step: step,
    plan_name: planName || "pro_dharma",
  });
}
