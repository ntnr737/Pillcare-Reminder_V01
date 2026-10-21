# HANDOVER

## Latest session: 2026-10-21 (model: Antigravity / Gemini 2.5 Pro)

### Done:
- **Universal Streak Management & Gamified Competition Engine (v1.0.82 Release)**:
  - **Comprehensive Workflow Architecture (`docs/STREAK_COMPETITION_WORKFLOW.md`)**:
    - Defined qualifying triggers: ≥80% daily dose adherence, or hydration (2000 mL) / clinical yoga fallback.
    - Specified Streak Saver Shield mechanics (1-day freeze protection against accidental misses) and fair-play anti-tamper rules.
    - Defined tier progression: Health Starter (1-6d) $\to$ Streak Warrior (7-13d, 2x XP) $\to$ Adherence Legend (14-29d, 3x XP) $\to$ Grand Master (30d+, 4x XP).
  - **Backend Management & Competition Endpoints (`backend/server.py`)**:
    - `GET /admin/streaks`: Live KPI metrics, competition list, brackets, and full global leaderboard.
    - `POST /admin/streaks/competitions`: Create/configure seasonal challenges (title, dates, target streak, prize pool).
    - `POST /admin/streaks/competitions/{id}/toggle`: Toggle competition between active and paused.
    - `POST /admin/streaks/{user_id}/shield`: Grant/revoke Streak Saver Shield protection for patient support.
    - `POST /admin/streaks/{user_id}/adjust`: Administrative adjustment of user streak days with mandatory audit reasoning.
    - `POST /admin/streaks/remind-at-risk`: Dispatches high-priority FCM v1 and Expo push reminders to patients pending daily doses.
    - Updated `GET /admin/users` to return `streak_days` and `streak_shield`.
    - Enriched `GET /api/leaderboard` with `active_competition`.
    - Deployed to Google Cloud Run revision `pillcare-backend-00095-jrg` serving 100% of traffic.
  - **Admin Panel Enterprise Dashboard (`/engagement/streaks` & `/users`)**:
    - Created dedicated dashboard at `/engagement/streaks` featuring 4 core KPI cards (Active Streaks, Average Platform Streak, Record Longest Streak, Streaks At Risk Today).
    - Added Active Competitions Grid with live status toggles, target streaks, and prize badges.
    - Added Live Competition Leaderboard table with medal rankings, streak badges, adherence %, XP, tier, and quick action buttons (Grant Shield, Adjust Streak).
    - Added "Streak Competitions" item to `Sidebar.tsx` with active flame badge.
    - Added Streak column and Streak Saver Shield controls to User Management page (`/users`).
    - Successfully compiled Next.js static export (26/26 routes) and served on `http://localhost:3000`.
  - **Mobile App Polish (`CalendarModal.tsx`)**:
    - Embedded Active Health Competition Banner in the `Streak Ranks` tab with target streak, title, description, and prize pool.
    - Tested 1-click Daily Streak Saver Shield activation with visual feedback and local persistence.
    - Bumped app to v1.0.82 (`versionCode: 82`, `versionName: "1.0.82"`).
    - Built `PillCare-v1.0.82-release.apk` with OpenJDK 17 and verified on `emulator-5554` with visual screenshot proof.
- Resolved background/closed app push notification delivery failures and fresh install historical notification spam (v1.0.81):
  - **Firebase & Google Services Configuration**: Registered `com.pillcare.reminder` under Firebase project `pillcare-5fcac`, extracted official `google-services.json` to `frontend/` and `frontend/android/app/`, configured `com.google.gms:google-services:4.4.2` in `build.gradle`, and applied plugin `com.google.gms.google-services`.
  - **Guest Token Registration**: Updated `save_push_token_flexible` in `backend/server.py` with `Depends(get_optional_user_id)` to accept unauthenticated guest user device tokens, assigning deterministic guest IDs (`guest_{tokenHash}`) with `is_guest: True` in MongoDB Atlas (`db.users` and `db.profile`).
  - **Direct Google Cloud FCM v1 Delivery**: Added native FCM v1 direct dispatch in `admin_broadcast_notification` (`backend/server.py`) using Google OAuth2 ADC credentials (`https://www.googleapis.com/auth/firebase.messaging`), bypassing third-party Expo relay server key dependencies. Pushes are delivered directly to Google Cloud FCM with `priority: HIGH`, `channel_id: broadcasts`, `visibility: PUBLIC`, and `notification_priority: PRIORITY_MAX`.
  - **Fresh Install Historical Push Isolation**: Added `firstInstalledAt` baseline timestamp in `frontend/src/lib/store.ts`. In `frontend/src/components/InAppBottomNotification.tsx`, removed `sendSystemNotificationBarAlert` from announcement polling to eliminate forged OS status bar alerts on launch. Added logic automatically marking announcements created prior to `firstInstalledAt - 5m` as seen/baseline, plus a 4-hour freshness lifespan for `flash` alerts.
  - **Dual-Token Client Pipeline**: Updated `frontend/src/lib/notifications.ts` and `frontend/src/lib/api.ts` to retrieve both Expo push token and native FCM registration token (`Notifications.getDevicePushTokenAsync()`).
  - **Full Quality Control & Verification**:
    - Compiled and installed release APK v1.0.81 (`versionCode: 81`, `versionName: "1.0.81"`).
    - Verified closed/killed app push notification delivery on `emulator-5554`: native Android notification shade heads-up alert appeared with sound and app icon (`qc_closed_app_push_delivered.png`).
    - Verified in-app flash notification delivery with image thumbnail and amber badge (`qc_open_app_flash_received.png`).
    - Verified fresh install 5-day isolation via `pm clear com.pillcare.reminder`: zero stale popups or historical notifications on launch (`qc_fresh_install_today_clean.png`), while newly broadcasted announcements appear immediately (`qc_fresh_install_new_alert_received.png`).
    - Verified live Cloud Run backend deployment (`pillcare-backend-00094-p5g`) and MongoDB campaign logging (`sent: 1`).
- Overhauled and verified the Android notification bar interactive action pipeline:
  - Resolved payload missing `data` / `medicationId` issue across scheduled and test notifications.
  - Implemented multi-tier fallback dose resolution (canonical dose key, nearest pending dose lookup).
  - Added immediate notification shade dismissal (`Notifications.dismissNotificationAsync`) so alerts clear instantly when an action is tapped.
  - Added immediate Android native OS toasts (`✓ Dose marked as taken`, `✕ Dose marked as skipped`, `⏱ Dose snoozed for 10 minutes`, `💧 Logged 250mL water`) for real-time patient feedback.
  - Replaced intrusive modal `Alert.alert` with non-blocking `ToastAndroid.show` on Android in `notification-settings.tsx`.
  - Added inter-tab `DeviceEventEmitter` and `addNotificationActionListener` to dynamically re-render the Today tab in real time when an action button is tapped without requiring manual page refresh.
  - Enhanced `synthesizeDosesForDate` and `bootstrapUserDataset` in `sync.ts` and `today.tsx` to ensure persistent local dose records (taken/skipped) strictly override server pending status (100% local-first guarantee).
- Live verified on real physical hardware (OnePlus `CPH2767IN` via Wi-Fi ADB `192.168.1.109:36357`):
  - `[ ✓ Taken ]` notification action button marked medication (Crocin) as taken, dismissed shade alert, and updated Today tab adherence to 100%.
  - `[ ✓ 250 mL ]` notification action button logged 250 mL water directly from Android notification shade, dismissed shade alert, updated water tracker to 250/2500 mL, and activated 15-minute renal pacing lockout.
- Conducted complete end-to-end Quality Control (QC) across all screens and local-first architecture:
  - Backend & Cloud Run: Verified health endpoint `https://pillcare-backend-1082668880575.europe-west1.run.app/health` (`{"status":"ok","db":"connected","v":"1.0.1"}`).
  - Local-First SQLite & Queue: Verified zero-latency offline writes for doses, yoga checklist, and measurements; verified `pc6_write_queue` enqueuing for cloud sync.
  - UI Glitch & Layout Fixes:
    - `today.tsx`: Resolved dose card horizontal overflow and FAB button collision by replacing side-by-side buttons with symmetrical, compact `[ ✕ Skipped ]` badge that smoothly reverts to `pending` on tap.
    - `support.tsx`: Replaced hardcoded version string with dynamic `Constants.expoConfig?.version` and `Constants.expoConfig?.android?.versionCode`.
    - `treatment.tsx`: Added friendly validation feedback and button opacity indicators for measurement and activity logging modals when fields are blank.
  - Onboarding & Core Navigation: Verified Welcome -> Guest Mode -> Step 1 -> Step 2 -> Step 3 -> Today -> Treatment -> Yoga -> Progress -> Support -> Nearby Stores.
- Completed comprehensive UI & video playback QC of the Yoga Therapy section (`frontend/app/(tabs)/yoga.tsx` & `frontend/src/components/VideoPlayerModal.tsx`):
  - Fixed YouTube Error 152 / 150 by removing spoofed origin/host parameters from `getYouTubeEmbedHtml` and setting `baseUrl: "https://www.youtube-nocookie.com"`.
  - Added smart auto-fallback on `YT_ERROR`: if YouTube restricts embedded playback, the player automatically switches to `youtube_web` (`https://m.youtube.com/watch?v=...`) with zero disruption.
  - Added `CLEAN_YOUTUBE_WEB_JS` CSS injection to hide mobile YouTube topbar headers, promo banners, pivot bars, and comments for a clean, distraction-free player.
  - Added a compact secondary toolbar in web stream mode with quick-access `[ Sound ]` toggle and `[ Rotate ]` fullscreen mode.
  - Fixed pose completion untoggling bug by adding `forceDone = true` guard in `toggleStepDone` (`yoga.tsx` & `treatment.tsx`), preventing completed poses from inverting when saving a video session.
  - Live verified video playback, time scrubbing, timer progression, post-pose reflection (`Energized & Alert`), AYUSH clinical insight generation, and habit log persistence on `emulator-5554`.
- Successfully compiled release APK v1.0.78 (`versionCode: 78`, `versionName: "1.0.78"`).
- Stream installed `PillCare-v1.0.78-release.apk` to Android emulator (`emulator-5554`) and captured screenshot evidence across all test gates.
- Completed comprehensive verification and end-to-end QC of Admin Panel feature controls and subscription tier management:
  - Fixed Next.js Admin Panel build: Resolved 2 TypeScript compiler errors (`registerTestPushToken` export, `'system'` category in `SystemReport`).
  - Fixed authentication header in `adminFetch`: Injected `x-admin-secret` so production requests authenticate against Cloud Run with live MongoDB telemetry instead of falling back to static mock data.
  - Implemented dynamic fallback routing in `client.ts` for bidirectional `/admin` and `/api/admin` endpoint resolution.
  - Connected Feature Flag controls: Wired `updateFeatureFlag` into UI switches and percentage rollout sliders in `app-control/feature-flags/page.tsx` with optimistic UI updates and error rollback.
  - Normalized subscription plan casing across client and server (`free`, `basic`, `premium`, `enterprise`), synchronizing `db.subscriptions` and `db.users`.
  - Fixed FastAPI bidirectional route aliasing in `backend/server.py` to index on `(path, methods)` tuple, preventing HTTP method collisions (e.g. GET `/admin/announcements`).
  - Executed 20/20 end-to-end integration tests verifying live stats, feature flag persistence in MongoDB, subscription tier switching (`free` -> `basic` -> `premium`), per-user feature overrides, and push broadcast delivery.
  - Verified mobile app feature gating on Android emulator: confirmed `UpgradePrompt` modal triggers on Free tier when attempting to access Pro Dharma capabilities (full yoga library, medication limits, scanner, export).
- Implemented and verified rich Flash Notifications and In-App Notifications with Text + Image support (v1.0.80):
  - Admin Panel (`admin-panel/src/app/engagement/notifications/page.tsx`): Built rich notification composer supporting Notification Styles (`flash`, `medication`, `offer`, `warning`, `info`), target audience cohorts, action route navigation (`/today`, `/treatment`, `/yoga`, `/progress`, `/support`), rich image URL inputs with 4 preset image chips, and a live simulated mobile phone preview bezel with real-time HUD rendering.
  - Mobile App (`frontend/src/components/InAppBottomNotification.tsx` & `frontend/app/_layout.tsx`):
    - Added image thumbnail (44x44 rounded cover) to the floating bottom notification card.
    - Added high-urgency amber `⚡ FLASH ALERT` theme with gold border and 15-second auto-dismiss HUD.
    - Added full detail modal rendering a 150px wide high-resolution hero banner image, high-contrast title and body text, amber `View & Take Action ->` button, and `Dismiss` button.
    - Implemented `Pressable` overlay gesture isolation so modal scroll and taps do not conflict with outer backdrop taps.
    - Added auto-dismiss timer pause logic so the notification does not dismiss while the user has the modal open.
  - Push Notification Integration: Foreground listener in `_layout.tsx` and status bar alert helper in `notifications.ts` wired to preserve `image_url` and notification `type`.
  - Backend API (`backend/server.py`): Updated `create_announcement`, `admin_broadcast_notification`, and `update_announcement` to accept and persist `image_url` and `type` into MongoDB `announcements`.
  - Android Release Build: Bumped version to `v1.0.82` (`versionCode: 82`), compiled `PillCare-v1.0.82-release.apk` with Gradle and OpenJDK 17, and stream-installed to `emulator-5554`.
  - Visual QC: Captured Android emulator screenshots verifying the floating banner card elevation above tabs, Calendar Streak modal with Active Competition Banner, Top 10 Champions, Streak Saver Shield activation, Today adherence card (100% adherence upon dose taken), Hydration logging, Yoga player guided studio, and Support settings with 120dp breathing room.
  - Deep QC Fixes:
    - `treatment.tsx`: Empty state card made interactive `TouchableOpacity` to open medication sheet; added local-first safe merge in `loadServer()` to protect offline pending meds.
    - `support.tsx`: Increased bottom padding to 120dp to eliminate cramping against tab bar; updated version fallback to `1.0.82 (82)`.
    - `AddMedicationSheet.tsx` & `PrimaryButton.tsx`: Added auto keyboard dismissal on save and primary button press.
    - `InAppBottomNotification.tsx`: Elevated floating notification to `bottom: Math.max(insets.bottom + 85, 95)` to eliminate tab bar/FAB overlap.

### In progress:
- All Deep QC fixes applied and verified on both mobile app and Admin Panel. Awaiting user confirmation to commit and push changes to GitHub `origin/main`.

### Broken or risky:
- None. Next.js admin build compiles cleanly (`npm run build` 26/26 routes static export); Python syntax check passes (`py_compile` 0 errors); TypeScript checks pass (`npx tsc --noEmit` 0 errors in both projects).

### Next:
- User confirmation to commit and push all changes to GitHub `origin/main`.

### Do not touch:
- `frontend/src/lib/notifications.ts`: `BACKGROUND_NOTIFICATION_TASK` must remain defined at module scope (outside React components) or Android headless intents will fail.
- `backend/server.py`: `/api/me/sync-state` response schema contract (critical for `bootstrapUserDataset` pre-hydration).

---
**Read first**: `docs/ARCHITECTURE.md`, `docs/CONSTRAINTS.md`
