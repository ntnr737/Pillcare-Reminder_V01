# DEFENSE: Interactive Notifications & Local-First Multi-Device Sync

> **Subsystem**: Mobile Notification Engine, Local-First Persistence & Server Optimization  
> **Target Release**: PillCare Mobile v1.0.17 / Backend v2.2.0  
> **Author**: Engineering Lead / Antigravity AI  

---

## 1. What It Does (2 Sentences)
PillCare delivers deterministic, clinically paced medication, hydration, and yoga reminders directly to the Android/iOS notification shade with 1-tap interactive confirmation actions (`Taken`, `Skip`, `Snooze 10m/1h`, `+250ml`). It provides instantaneous local-first multi-device synchronization without data loss, while cutting Cloud Run server requests by >83%.

---

## 2. How It Works (Flow Sketch)
1. Reminders are scheduled locally on the device using `expo-notifications` with high-priority channels and exact timestamps.
2. When an action is tapped in the OS shade, `expo-task-manager` catches the background intent via `BACKGROUND_NOTIFICATION_TASK`.
3. The canonical dose key (`getCanonicalDoseId`) is derived deterministically and written to local `AsyncStorage` dual-key registry, updating the UI immediately.
4. Mutation queues locally and syncs to `/api/doses/{id}/status` asynchronously.
5. On new device login, `bootstrapUserDataset` fetches `/api/me/sync-state` in one atomic payload, caching all medications, doses, hydration, and yoga before tabs render.
6. A 5-minute SWR TTL prevents repeated server hits on tab transitions.

---

## 3. Key Decisions & Why X Over Y
- **Headless Task Manager over Opening App**: Patients should not have their screen hijacked when confirming medicine or water.
- **Consolidated `GET /api/me/sync-state` over 6 Parallel Requests**: Eliminates connection congestion on Cloud Run and guarantees atomic hydration on Device B.
- **Clinical 30-min Follow-up over Nag Loops**: Apple Health clinical benchmark avoids notification fatigue and prevents users from disabling app notifications.
- **5-min SWR Cache over Indefinite Cache**: Balances real-time freshness for caregivers with >83% reduction in server bills.

---

## 4. Data Structures & Why
- **Canonical Dose Key (`local_dose_{medId}_{date}_{time}`)**: $O(1)$ key-value lookup that can be generated deterministically on device without network round-trips.
- **Dual-Key Status Registry**: Maps both canonical IDs and `(medId, time)` tuples to guarantee matching regardless of push origin.
- **FIFO Offline Queue**: Preserves mutations during network disconnects and flushes on reconnect.

---

## 5. Threat Modeling: How a Malicious Actor Could Abuse It
- **Crash Flood**: Attacker bombs `/api/analytics/crash` to inflate server costs -> Throttled with SlowAPI rate limiting (10 req/min) and 2KB payload limits.
- **Adherence Spoofing**: User submits future dose confirmations to game leaderboards -> Server rejects timestamps > 5 minutes ahead.
- **Deep-Link Injection**: External intent tries to navigate to internal routes -> Sanitized against strict route allowlist in `notifications.ts`.

---

## 6. Failure Modes & How We Notice
- **Backend Offline**: App functions 100% offline; changes queue locally. Notice via `/health` uptime monitoring.
- **Battery Saver Task Killing**: Aggressive OEM battery optimizers kill background task -> User opening app still sees in-app notification banners; Sentinel Agent tracks confirmation ratios.
- **Storage Corruption**: `JSON.parse` safe wrapper clears corrupted key and triggers re-hydration from server.

---

## 7. The Whiteboard Drill Self-Test (12 Questions Answered)

1. **What does it do?** Delivers lock-screen interactive reminders and syncs health progress across devices offline-first.
2. **Walk through one request:** Notification tap -> `TaskManager` -> `recordTaken` -> local storage update -> async POST -> SWR cache hit.
3. **Why this approach over obvious alternative?** Native background tasks avoid interrupting the user by forcing the app open.
4. **Most important data structure?** Canonical dose tuple key enabling offline deterministic ID parity.
5. **Worst thing an anonymous user could try?** Spam crash analytics endpoint (mitigated by IP rate limit).
6. **Malicious logged-in user?** Spoof dose timestamps (mitigated by server timestamp boundary validation).
7. **Main dependency down for an hour?** Zero user disruption; app runs offline and queues writes.
8. **First limit expected as usage grows?** MongoDB connection pool saturation on Cloud Run (mitigated by atomic endpoint reducing connections by 6x).
9. **How would you know it broke before a customer told you?** Sentinel Agent flags drops in notification action confirmation rates.
10. **How do you undo last change safely?** Revert git commit; rollback feature flag.
11. **What did the AI assume that was verified?** Verified that `TaskManager.defineTask` works at top-level module scope on Expo 57.
12. **What would you change with another week?** Add interactive home screen widget support for iOS and Android.
