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

---

## D-013: Android Notification Shade Action Buttons Pipeline & Real-Time Sync

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Medication reminder action buttons (`[ ✓ Taken ]`, `[ ✕ Skip ]`, `[ ⏱ 10 Min ]`, `[ ⏱ 1 Hour ]`, `[ 💧 250mL ]`) in the Android system notification bar were not updating dose state properly due to payload data inconsistency (empty `data` on test alerts, strict `data.medicationId` matching, missing notification dismissal, and no live UI re-render event).
- **Options**:
  1. Only update UI upon full app relaunch or manual pull-to-refresh; leave notification active in shade until user manually swipes it away.
  2. Implement comprehensive notification action pipeline:
     - Multi-level medication and dose ID normalization with nearest pending dose fallback.
     - Immediate notification shade dismissal via `Notifications.dismissNotificationAsync()`.
     - Instant native Android OS toasts (`ToastAndroid`) for immediate patient confirmation.
     - Inter-tab `DeviceEventEmitter` & `addNotificationActionListener` for zero-latency screen updates.
     - Enforce local dose registry overrides in `synthesizeDosesForDate` and `bootstrapUserDataset` (100% local-first consistency).
- **Chosen**: Option 2.
- **Why**: Patients rely heavily on interacting directly from the Android status bar without switching into the app. Immediate shade dismissal and OS toast confirmation reassure the patient that the dose was recorded, while local-first storage ensures the Today tab reflects the update instantly.
- **Trade-off**: Requires listener lifecycle cleanup in tab components.
- **Revisit if**: Android 16+ introduces breaking notification trampoline changes.

---

## D-014: Non-Blocking Status Bar Toast Alerts & Physical Device Action Button Verification

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: In `notification-settings.tsx`, test dispatches displayed an intrusive blocking OS `Alert.alert` modal dialog on screen that intercepted user touches and prevented direct interaction with the Android notification shade. Additionally, hydration action buttons (`[ ✓ 250 mL ]`) needed live hardware verification.
- **Options**:
  1. Keep `Alert.alert` modal dialog for all dispatches.
  2. Use non-blocking `ToastAndroid.show()` on Android for test dispatch confirmations, preserving `Alert.alert` only on iOS; live-verify medication and hydration action buttons on real physical hardware (`CPH2767IN`).
- **Chosen**: Option 2.
- **Why**: Non-blocking Android toasts allow the user to immediately expand the notification shade and tap action buttons without having to dismiss an on-screen modal dialog first.
- **Trade-off**: Toasts auto-dismiss after ~2 seconds on Android.
- **Revisit if**: Custom animated in-app snackbar is implemented across platforms.

---

## D-015: End-to-End App QC, Symmetrical Dose Action Badges, & Dynamic Build Telemetry

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: During comprehensive QC across all application screens, three visual/UX issues were identified:
  1. In `today.tsx`, marking a dose as `Skipped` displayed both `[ Skipped ]` and `[ Mark Taken ]` side by side, which expanded the row and overlapped the floating action button (FAB) on compact screens.
  2. In `support.tsx`, the version footer was hardcoded to `v1.0.71 (Build 71)`.
  3. In `treatment.tsx`, measurement and activity modals silently suppressed clicks when input was empty without providing user feedback.
- **Options**:
  1. Keep existing side-by-side buttons and require scrolling; leave footer static.
  2. Standardize on symmetrical interactive badges:
     - `today.tsx`: Render a single touchable `[ ✕ Skipped ]` badge (matching `[ ✓ Taken ]`) that toggles back to `pending` upon tap.
     - `support.tsx`: Dynamically extract `Constants.expoConfig?.version` and `Constants.expoConfig?.android?.versionCode`.
     - `treatment.tsx`: Provide immediate visual feedback (`opacity: 0.6`) and OS alerts on empty submissions.
- **Chosen**: Option 2.
- **Why**: Keeps dose cards clean and eliminates clipping or FAB collisions on all Android device screen sizes. Guarantees version telemetry matches Gradle build configs, and provides clear UX validation for patient data entry.
- **Trade-off**: Requires users to tap once to un-skip before marking taken (mirroring the `Taken` undo interaction).
- **Revisit if**: Swipe-to-action gesture replaces button badges.

---

## D-016: Yoga Section YouTube Video Player Resilience, Embed Auto-Fallback & Habit Logging

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: In the Yoga therapy tab (`frontend/app/(tabs)/yoga.tsx`), opening guided video poses (Swami Ramdev, AYUSH, Sadhguru) encountered multiple playback and state anomalies:
  1. YouTube returned Error 152 / 150 inside Android WebView due to origin spoofing (`origin: 'https://www.youtube.com'`) and creator-level embedding restrictions.
  2. The WebView JS bridge did not recover from `YT_ERROR`, leaving users stranded on an error placeholder.
  3. Mobile web YouTube (`m.youtube.com/watch?v=...`) played reliably but displayed app headers, promo banners, and comment sections.
  4. Completing a video session toggled pose completion, which inverted already-completed poses back to uncompleted.
  5. Fullscreen landscape mode did not preserve the active player mode or clean CSS injection.
- **Options**:
  1. Force all YouTube playback into external browser or YouTube app via `Linking.openURL()`.
  2. Implement hybrid player resilience:
     - Remove spoofed origin/host headers in `getYouTubeEmbedHtml` and use `baseUrl: "https://www.youtube-nocookie.com"`.
     - Automatically switch `playerMode` to `youtube_web` upon receiving any `YT_ERROR` code (150, 152, 101, 100, 2, 5).
     - Inject clean styles (`CLEAN_YOUTUBE_WEB_JS`) via `injectedJavaScript` and `injectedJavaScriptBeforeContentLoaded` to hide headers, comments, and pivot bars for a distraction-free player.
     - Add `forceDone = false` parameter to `toggleStepDone` so completing a session guarantees completion without accidental untoggling.
     - Unify fullscreen view to mirror the active `playerMode` and maintain CSS cleaning.
- **Chosen**: Option 2.
- **Why**: Option 1 kicks the patient out of the app, losing session timer tracking and post-pose reflection insights. Option 2 provides a seamless, distraction-free in-app studio experience that plays 100% of YouTube yoga poses while preserving local-first habit logging.
- **Trade-off**: Requires injecting CSS rules that target YouTube mobile DOM classes.
- **Revisit if**: YouTube significantly updates mobile web class names or introduces strict Content Security Policies that block injected styles.

---

## D-017: Admin Panel Feature Control, Secret Authorization, and Subscription Plan Normalization

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Verification of Admin Panel controls over mobile app features, live telemetry fetching, and subscription plan gating identified critical synchronization issues:
  1. Next.js Admin Panel had 2 TypeScript compiler errors (`registerTestPushToken` missing export, `'system'` category missing in `SystemReport`).
  2. `adminFetch` in `admin-panel/src/lib/api/client.ts` omitted the `x-admin-secret` header, causing the backend to reject requests and fall back to mock data.
  3. Feature flag UI toggles and percentage rollout sliders in `app-control/feature-flags/page.tsx` only modified local React state and never dispatched `PUT /api/admin/feature-flags/{key}` to MongoDB.
  4. Subscription plan management sent capitalized names (`'Premium'`, `'Basic'`) from `users/page.tsx`, failing exact match against `PLAN_FEATURES` lowercase dictionary keys in `server.py`, causing upgraded users to be capped at free tier limits.
  5. Bidirectional route mirroring for `/admin` vs `/api/admin` only tracked path strings, causing route collisions across HTTP methods (e.g. GET `/admin/announcements` was omitted because POST `/admin/announcements` registered first).
- **Options**:
  1. Maintain mock data fallbacks in the admin UI and require manual MongoDB edits for feature gating.
  2. Integrate live backend communication:
     - Inject `x-admin-secret` with automatic `/admin` vs `/api/admin` URL resolution and fallback.
     - Wire `updateFeatureFlag` into feature flag toggles and rollout sliders with optimistic UI updates and error rollback.
     - Normalize plan strings to lowercase across client and server (`free`, `basic`, `premium`, `enterprise`), synchronizing `db.subscriptions` and `db.users`.
     - Update dynamic route aliasing to index on `(path, methods)` tuple.
- **Chosen**: Option 2.
- **Why**: Ensures complete bidirectional control from the Next.js admin dashboard to the mobile app runtime. Admins can instantaneously trigger maintenance mode, adjust rollout percentages, modify caregiver alert limits, and upgrade user tiers with instant reflection on connected mobile clients.
- **Trade-off**: Requires keeping `NEXT_PUBLIC_ADMIN_SECRET` configured in deployment environments.
- **Revisit if**: Moving to OAuth2 granular RBAC with service account IAM delegation.

---

## D-018: Rich Flash Notifications & In-App Alerts with Text, Hero Images, and 15s Auto-Dismiss HUD

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: The user requested rich Flash and In-App notification controls from both the Web Admin Panel and the Android/iOS Mobile App, supporting both rich text and images, high-priority visual presentation, and full end-to-end QC.
  1. The Admin Notification Composer lacked rich image URL inputs, preset image chips, and multi-channel style selection (`flash`, `medication`, `offer`, `warning`, `info`).
  2. Mobile App lacked visual image thumbnail rendering in the floating bottom banner and full hero banner image rendering in the modal.
  3. `flash` notifications required high-urgency amber/gold styling with an automatic 15-second dismissal timer, paused while the modal is open.
  4. Backend `create_announcement`, `admin_broadcast_notification`, and `update_announcement` needed explicit `image_url` payload handling and propagation to push payloads.
- **Options**:
  1. Use standard plain-text push notifications only via Expo Push Service.
  2. Implement an omni-channel rich notification pipeline:
     - Admin Composer with image URL input, 4 quick preset image chips (`Medication Refill`, `Yoga Therapy`, `Flash Alert`, `Special Offer`), notification style selector, route destination picker, and live interactive simulated mobile preview bezel.
     - Mobile `InAppBottomNotification` with image thumbnail in floating bottom card, gold accent border for flash alerts, 15-second auto-dismiss timer, and rich hero banner image in full detail modal with `Pressable` overlay gesture isolation.
     - OS status bar heads-up push dispatch with matching notification type, title, and image payload.
     - Backend persistence of `image_url` and `type` in MongoDB `announcements`.
- **Chosen**: Option 2.
- **Why**: Delivers a modern healthcare engagement experience matching industry leaders (Swiggy/Zomato flash alerts, Apple Health alerts), allowing administrators to broadcast visual health announcements, medication reminders, and wellness prompts with instant visual feedback and deep-link routing.
- **Trade-off**: Requires image assets to be accessible over HTTPS.
- **Revisit if**: Introducing offline local image caching or rich rich-text markdown rendering in announcements.

---

## D-019: Direct Google Cloud FCM v1 Background Delivery, Guest Device Token Support, and Fresh Install Historical Isolation

- **Date**: 2026-10-21
- **Model**: Antigravity / Gemini 2.5 Pro
- **Context**: Users reported two critical notification issues:
  1. Push notifications were never arriving when the mobile app was closed/in background, only appearing when the app was actively open in foreground.
  2. Newly installing users (e.g., installing on Day 5) were bombarded with historical push notifications and stale announcements from the past.
- **Root Cause Analysis**:
  1. **Closed App Push Delivery Failure**:
     - Android project lacked official `google-services.json` and the `com.google.gms.google-services` plugin was omitted from `build.gradle`. As a result, Firebase Messaging was uninitialized in the app process.
     - Backend `save_push_token_flexible` enforced mandatory user authentication (`Depends(get_current_user_id)`). Any guest or unauthenticated user had their push token registration rejected with HTTP 401 Unauthorized, resulting in 0 registered tokens in MongoDB.
     - Expo push service relay (`https://exp.host/--/api/v2/push/send`) rejected pushes due to missing FCM v1 server keys on Expo servers (`InvalidCredentials`).
     - Push payloads specified `"channelId": "default"` (`AndroidImportance.DEFAULT`) instead of high-priority heads-up `"broadcasts"` channel (`AndroidImportance.MAX`).
  2. **Fresh Install Push Spam**:
     - `InAppBottomNotification.tsx` previously dispatched `sendSystemNotificationBarAlert(...)` inside `fetchActiveAnnouncements()` on every app startup and 5-minute poll. Any user installing after multiple announcements had been published had system notifications forged locally for ancient announcements.
     - There was no install date baseline filter, treating months-old announcements as fresh alerts.
- **Solution Architecture**:
  1. **Google Services & Firebase Setup**:
     - Registered package `com.pillcare.reminder` under Firebase project `pillcare-5fcac`.
     - Placed `google-services.json` in `frontend/` and `frontend/android/app/`.
     - Configured `classpath('com.google.gms:google-services:4.4.2')` in root `build.gradle` and `apply plugin: 'com.google.gms.google-services'` in `app/build.gradle`.
  2. **Guest Token & Dual-Registration Pipeline**:
     - Updated `frontend/src/lib/notifications.ts` to fetch both Expo push token and native Google FCM token via `Notifications.getDevicePushTokenAsync()`.
     - Updated `backend/server.py` `save_push_token_flexible` with `Depends(get_optional_user_id)`. Unauthenticated guest users are assigned a deterministic guest ID (`guest_{tokenHash}`) and stored with `is_guest: True` in both `db.users` and `db.profile`.
  3. **Direct Google Cloud FCM v1 Dispatch**:
     - Backend `admin_broadcast_notification` partitions tokens into native FCM tokens and Expo tokens.
     - For FCM tokens, it obtains an OAuth2 access token with `https://www.googleapis.com/auth/firebase.messaging` scope via Google Cloud ADC and dispatches directly to `https://fcm.googleapis.com/v1/projects/pillcare-5fcac/messages:send` with `priority: HIGH`, `channel_id: broadcasts`, `visibility: PUBLIC`, and `notification_priority: PRIORITY_MAX`.
     - Zero reliance on third-party relay; 100% native delivery to closed/background devices.
  4. **Fresh Install Baseline & 4-Hour Lifespan**:
     - Added `firstInstalledAt` timestamp to local store on first launch (`getAppInstallTimestamp()`).
     - Removed `sendSystemNotificationBarAlert` from announcement polling.
     - Filtered announcements created before `firstInstalledAt - 5m` window, automatically marking them as seen/baseline.
     - Implemented 4-hour freshness lifespan for `flash` announcements (`Date.now() - created_at > 4 * 3600 * 1000` auto-marked seen).
- **Verification**:
  - Live Android emulator tests with app closed confirmed native Android notification shade delivery (`tag=FCM-Notification:45762721`, `channel=broadcasts`, `importance=5`).
  - Fresh install test (`pm clear com.pillcare.reminder`) verified zero historical announcements popping up, while newly dispatched announcements appear instantaneously in foreground and background.
- **Trade-off**: Requires Cloud Run service account or environment credentials to maintain `firebase.messaging` IAM permission.
- **Revisit if**: Introducing localized push payload translations.







