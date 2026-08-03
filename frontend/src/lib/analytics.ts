/**
 * analytics.ts — In-app event tracking
 * Sends events to PillCare backend (/api/analytics/track)
 * which stores them in MongoDB for the admin dashboard.
 *
 * NO third-party SDK needed — all data stays in your own database.
 * Admin dashboard at pillcare.in/admin shows all events in real time.
 */

import { api } from "./api";

export type EventName =
  | "app_open"
  | "dose_taken"
  | "dose_missed"
  | "dose_skipped"
  | "medication_added"
  | "medication_deleted"
  | "nearby_searched"
  | "nearby_called"
  | "nearby_directions"
  | "yoga_viewed"
  | "yoga_reminder_set"
  | "yoga_done"
  | "appointment_saved"
  | "appointment_called"
  | "caregiver_connected"
  | "export_tapped"
  | "export_completed"
  | "upgrade_prompt_shown"
  | "upgrade_prompt_dismissed"
  | "profile_updated"
  | "sign_in"
  | "sign_out"
  | "health_connect_tapped"
  | "faq_opened"
  | "support_tapped";

export async function track(event: EventName, props: Record<string, any> = {}): Promise<void> {
  try {
    await api.trackEvent(event, props);
  } catch {
    // Never block the user — analytics are fire-and-forget
  }
}
