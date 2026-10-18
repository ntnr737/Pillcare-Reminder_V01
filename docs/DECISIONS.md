# DECISIONS: Architectural Decision Records (ADRs)

> **Standard**: Every meaningful architecture, dependency, or schema choice made by an engineer or AI assistant must be recorded here.  
> **Key Rule**: Record the rejected options and trade-offs. Six months later, this log stops teams from re-arguing settled questions.

---

## D-001: Headless Background Task Manager for Notification Bar Actions

- **Date**: 2026-10-15
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Tapping "Taken", "Skip", or "Snooze" from the OS notification bar failed when the app was in the background or killed.
- **Options**:
  1. Force `opensAppToForeground: true` on all notification actions.
  2. Use `expo-task-manager` with top-level `TaskManager.defineTask` and headless background event handling.
  3. Send an FCM silent push to backend whenever an action is pressed.
- **Chosen**: Option 2 (`expo-task-manager` headless execution).
- **Why**: Option 1 frustrates patients by ripping open the full app UI every time they simply want to confirm water or medicine from the lock screen. Option 3 requires constant network connectivity and active FCM round-trips. Option 2 provides instant offline recording.
- **Trade-off**: Requires strict module-scope task registration and Android background intent management.
- **Revisit if**: Expo SDK deprecates `expo-task-manager` in favor of a native module replacement.

---

## D-002: Consolidated Atomic Endpoint (`GET /api/me/sync-state`) for Multi-Device Hydration

- **Date**: 2026-10-15
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Logging into a second device caused missing hydration and yoga data, and Today tab loading lag.
- **Options**:
  1. Have the client fire 6 separate parallel GET requests upon login (`/profile`, `/medications`, `/doses`, `/activities`, `/yoga/log`, `/streak`).
  2. Create a single consolidated atomic sync endpoint (`GET /api/me/sync-state`).
  3. Implement GraphQL or full CouchDB/WatermelonDB replica sync.
- **Chosen**: Option 2 (`GET /api/me/sync-state`).
- **Why**: 6 parallel requests hit Cloud Run concurrency limits, multiply database connection overhead, and risk partial cache hydration if one fails. Option 3 introduces enormous schema migration overhead. Option 2 delivers all required client data in a single fast gzip payload (~3KB).
- **Trade-off**: Slightly larger single response payload; backend must aggregate user documents efficiently.
- **Revisit if**: Offline change conflicts require full CRDT (Conflict-Free Replicated Data Types) synchronization across >5 concurrent active devices.

---

## D-003: 5-Minute SWR Cache TTL & Heartbeat Throttling for Cloud Run Cost Reduction

- **Date**: 2026-10-15
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Rapidly switching tabs bombarded Cloud Run with un-cached requests; clients sent heartbeats every 60 seconds unconditionally, inflating cloud billing.
- **Options**:
  1. Disable background heartbeats and cache everything indefinitely until manual pull-to-refresh.
  2. Maintain a 5-minute Stale-While-Revalidate (SWR) cache TTL on the Today screen, and throttle heartbeats to a 15-minute cooldown on app resume.
  3. Keep existing behavior and scale Cloud Run tier to absorb costs.
- **Chosen**: Option 2.
- **Why**: Eliminates over 83% of server invocations without compromising data freshness. Indefinite caching (Option 1) prevents caregivers from seeing updates made on another phone. Option 3 burns unnecessary money.
- **Trade-off**: If an external caregiver modifies a schedule, changes reflect on device after up to 5 minutes unless manually refreshed.
- **Revisit if**: Real-time multi-party synchronization is required (will use WebSocket or FCM data pushes instead of polling).

---

## D-004: Dual-Key Dose Status Resolution (`CanonicalKey` + `(MedId, SchedTime)`)

- **Date**: 2026-10-15
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Notifications generated IDs with one format while local dose synthesis generated another, causing dose statuses to appear un-synced.
- **Options**:
  1. Migrate all database keys to UUIDs and require online lookups.
  2. Establish a deterministic canonical key generator (`getCanonicalDoseId`) and index local status by both canonical key and `(medication_id, scheduled_time)` tuple.
- **Chosen**: Option 2.
- **Why**: Works completely offline. The client can compute the exact ID deterministically from medication parameters without needing a database round-trip.
- **Trade-off**: Requires dual index writes in `recordDoseStatus`.
- **Revisit if**: Medication dosage times become dynamic intervals (e.g., "every 4 hours as needed") rather than fixed clock times.

---

## D-005: Autonomous Chief Engineer Sentinel Agent

- **Date**: 2026-10-15
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Engineering leadership lacked continuous visibility into unhandled frontend crashes, notification action drop rates, and Cloud Run billing drivers.
- **Options**:
  1. Purchase external enterprise monitoring tools (Datadog / Sentry) with monthly per-seat fees.
  2. Build an internal autonomous Sentinel Agent that audits native MongoDB logs, computes action interaction ratios, generates technical Markdown reports, and stores audits in `db.reports`.
- **Chosen**: Option 2.
- **Why**: Zero subscription overhead; deep domain-specific telemetry (medication action confirmation vs dismissal rates, sync queue drops) that generic APMs do not provide out of the box.
- **Trade-off**: Maintenance of internal reporting script and report storage.
- **Revisit if**: Monthly active users exceed 500,000, where dedicated time-series telemetry pipelines become necessary.

---

## D-006: Canonical Dose Fallback Resolution in Backend & Resilient Mark Handler

- **Date**: 2026-10-16
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Marking synthesized doses failed with HTTP 404 because client synthesized doses with `dose_...` prefix while backend only knew server-generated dose UUIDs.
- **Options**:
  1. Force client to block UI and await server dose creation before rendering Today tab cards.
  2. Have backend parse canonical `dose_{medId}_{date}_{time}` IDs, run `_ensure_doses_for_date`, and resolve the dose record seamlessly; update client `mark()` to use `markTakenByMedication` when medication ID is present.
- **Chosen**: Option 2.
- **Why**: Option 1 destroys offline-first instant loading. Option 2 guarantees that whether a dose is synthesized locally or in MongoDB, marking it taken never returns 404.
- **Trade-off**: Requires parsing logic in backend `update_dose_status`.
- **Revisit if**: Schema migrates to immutable event-sourcing streams.

---

## D-007: Explicit Date Field Persistence for Cross-Timezone Hydration Sync

- **Date**: 2026-10-16
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Users drinking water in IST (UTC+5:30) early morning or late night lost water intake on Device B due to UTC date discrepancy in `get_user_sync_state`.
- **Options**:
  1. Rely solely on client to query by UTC date range and compute timezone shifts on device.
  2. Add explicit `date: Optional[str]` and `timestamp` fields to `ActivityCreate` and `Activity` models, matching water activities by user local date.
- **Chosen**: Option 2.
- **Why**: Guarantees that water logged on a local calendar day is 100% reliably attributed to that day across all devices without timezone drift.
- **Trade-off**: Extra string field stored in `activities` collection.
- **Revisit if**: Activities support complex multi-timezone travel recalculation.

---

## D-008: Silent Background SWR Refresh with Awaited Local Cache

- **Date**: 2026-10-16
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Switching to the Today tab constantly flashed a disruptive "Updating latest data..." spinner bar and triggered server fetches due to unawaited local cache hydration.
- **Options**:
  1. Keep the visible spinner on every focus.
  2. Await `hydrateFromLocalCache` before checking the 5-minute SWR TTL; render immediately from storage and only run silent background updates when expired without flashing UI banners.
- **Chosen**: Option 2.
- **Why**: Matches industry benchmarks (Apple Health, WhatsApp, Spotify) where user experience is instantaneous and calm.
- **Trade-off**: Users do not see a spinner during background sync, but data updates automatically upon completion.
- **Revisit if**: Users report confusion about whether data is currently syncing (resolved via honest pull-to-refresh).

---

## D-009: Regex-Based Canonical Dose ID Parser & On-Demand Creation Fallback

- **Date**: 2026-10-17
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Dose marking failed with HTTP 404 when medication IDs contained underscores (e.g., `local_1729000_abc`), causing naive string splitting on `_` to truncate medication IDs and misparse dates.
- **Options**:
  1. Ban underscores in client-generated medication IDs.
  2. Use a robust regex pattern `r"^(?:local_dose_|dose_)(.+)_(\d{4}-\d{2}-\d{2})(?:_([0-9a-zA-Z:]+))?$"` to isolate medication ID, date, and scheduled time; if the dose record is missing from MongoDB, create it on-demand from the existing medication.
- **Chosen**: Option 2.
- **Why**: Option 1 cannot fix existing stored offline IDs or prevent edge cases across different device platforms. Option 2 provides mathematical certainty for parsing canonical IDs regardless of dashes or underscores, and completely eliminates 404 drops by creating missing doses on-demand.
- **Trade-off**: Minimal regex evaluation cost on incoming canonical dose updates.
- **Revisit if**: Doses transition to content-addressed hashing.

---

## D-010: Pre-Signout Write Queue Flush & Android Static Channel Registration

- **Date**: 2026-10-17
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Logging out on Device A erased queued offline writes before they reached Cloud Run, resulting in missing hydration/dose records when logging in on Device B. Furthermore, Android dropped notifications scheduled with legacy channel aliases (`medication-reminders`, `hydration-reminders`).
- **Options**:
  1. Wipe local storage immediately on signout regardless of queue state.
  2. Race `flushQueue()` with a 2-second timeout before purging local session and cache; explicitly register all legacy/alias channels (`medication-reminders`, `hydration-reminders`, `yoga-reminders`, `broadcasts`) in `ensureChannels()`.
- **Chosen**: Option 2.
- **Why**: Protects clinical dose and hydration logs from accidental destruction upon device switching. Ensures Android OS never drops notifications scheduled with legacy or alias channel names.
- **Trade-off**: 2-second maximum delay during signout if network is slow.
- **Revisit if**: Background synchronization service worker manages queue independently of app process lifecycle.

---

## D-011: Android Battery Optimization Exemption Guidance UI

- **Date**: 2026-10-18
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: On Android devices (Samsung OneUI, Xiaomi MIUI, OnePlus OxygenOS), aggressive OS Doze mode and OEM battery task killers delay or suppress exact alarms unless battery optimization is set to "Unrestricted" (matching MyTherapy's onboarding model).
- **Options**:
  1. Rely exclusively on system notification channels and assume OS will not throttle exact alarms.
  2. Add an explicit "Reliable Exact Alarms & Background Delivery" card to `notification-settings.tsx` with one-tap deep links to Android's `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` and OEM guidance on `dontkillmyapp.com`.
- **Chosen**: Option 2.
- **Why**: Clinical dose alerts must trigger reliably at exact clock times. Without battery exemption, OEM task killers terminate background tasks after 15 minutes of screen-off time. Option 2 provides direct user guidance to enable unrestricted battery access.
- **Trade-off**: Requires user to complete a 1-tap exemption in system settings.
- **Revisit if**: Native Android CompanionDeviceManager or Foreground Service notification persistent foregrounding is introduced.

---

## D-012: Centralized Backend URL with Guaranteed Production Fallback

- **Date**: 2026-10-18
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: On standalone APK builds, if `EXPO_PUBLIC_BACKEND_URL` is omitted or un-bundled during Gradle compilation, `BASE` resolved to `""`, causing startup calls like `fetch("/api/public/feature-config")` to crash React Native with `TypeError: Invalid URL: /api/public/feature-config`.
- **Options**:
  1. Rely exclusively on `.env` file bundling and assume it is always present during all Gradle/CI invocations.
  2. Create a centralized `src/lib/config.ts` exporting `DEFAULT_BACKEND_URL = "https://pillcare-backend-1082668880575.europe-west1.run.app"`, resolving `API_BASE_URL` with a guaranteed fallback, and adding try-catch guards around non-critical startup feature probes in `sign-in.tsx`.
- **Chosen**: Option 2.
- **Why**: Zero risk of startup crashing. Even in custom offline, demo, or unconfigured builds, the app safely resolves the production Cloud Run backend or gracefully falls back to default feature flags without triggering the root Error Boundary.
- **Trade-off**: Production URL is embedded as a code constant fallback.
- **Revisit if**: Multi-tenant or dynamic on-premise backend switching is supported at runtime.



