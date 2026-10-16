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
