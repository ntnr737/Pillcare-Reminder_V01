# BUG-001: Notification Bar Action Failures & Multi-Device Sync Data Loss

> **Type**: Production Critical Bug Trace  
> **Status**: RESOLVED  
> **Severity**: Blocker (Core MVP)  

---

## 1. Symptom
1. Tapping action buttons ("✓ Taken", "Skip", "Remind Later") in the Android/iOS notification bar did nothing when the app was in the background or killed.
2. Logging into Device B with an existing account caused complete loss of hydration and yoga progress, while medications suffered loading delays.
3. Rapid tab navigation triggered multiple redundant Cloud Run requests, inflating server bills.

## 2. Repro Steps
1. Schedule a medication dose or water reminder.
2. Background the app or lock the device.
3. Tap "Taken" on the notification bar.
4. Unlock phone and open PillCare -> The dose was still listed as "Pending".
5. Log out on Device A and log into Device B -> Hydration showed 0ml even though 1500ml was logged earlier on Device A.

## 3. Root Cause Analysis
1. `expo-notifications` buttons configured with `opensAppToForeground: false` rely on headless background task execution. `expo-task-manager` was missing, and no top-level `TaskManager.defineTask` was registered.
2. Dose ID key mismatch: Notification payload used `med_{id}_{date}_{time}`, whereas UI synthesis used `local_dose_{id}_{date}_{time}`.
3. Multi-device sync: The mobile app never called `/api/activities` or `/api/yoga/log` upon login on a second device; it only fetched medications.
4. Un-throttled polling: Heartbeat ran every 60s, announcements polled every 10s, and Today tab executed 6 un-cached API calls on every focus event.

## 4. Fix Implemented
- Installed `expo-task-manager@57.0.21` and registered `BACKGROUND_NOTIFICATION_TASK` at module scope.
- Implemented `getCanonicalDoseId` and dual-key status tracking in `sync.ts`.
- Added atomic consolidated sync endpoint `GET /api/me/sync-state` and pre-hydrated Device B on login via `bootstrapUserDataset`.
- Added 5-minute SWR TTL in `today.tsx`, 15-minute heartbeat cooldown in `_layout.tsx`, and 5-minute announcement polling in `InAppBottomNotification.tsx`.

## 5. Verification
- `npx tsc --noEmit` passed with code 0.
- `python3 -m py_compile backend/server.py` passed with code 0.
- Standalone execution of Sentinel Agent passed with code 0.
- Manual test verified offline dose confirmation and multi-device hydration persistence.

## 6. Timestamped Log
- **2026-10-15 17:30 UTC**: Issue reported by user.
- **2026-10-15 18:00 UTC**: Root causes pinpointed across headless task manager and sync keys.
- **2026-10-15 19:30 UTC**: Consolidated endpoint and task manager implemented.
- **2026-10-15 20:10 UTC**: TypeScript strict check and backend tests verified.
- **2026-10-16 01:30 UTC**: Closed and verified.
