# FLOW: Execution Paths & Tracing

> **Scope**: End-to-end execution paths between UI, background tasks, local storage, and the Cloud Run backend.  
> **Comprehensive Workflows Reference**: See [`docs/WORKFLOWS.md`](WORKFLOWS.md) for detailed sequence diagrams, 7 Laws of Local-First, Renal Pacing, Battery Optimization, Cost Optimization, and CI/CD pipelines.  
> **Key Insight**: Bugs live in the gaps between files. Tracing every step exposes where failures occur.

---

## 1. Flow A: Interactive Notification Bar Action (`✓ Taken`)

When the user taps the action button directly from the Android/iOS notification shade:

```
[OS Notification Shade] 
   │  User taps "✓ Taken" (Action ID: "MARK_TAKEN")
   ▼
[expo-task-manager] Background Intent Execution
   │  Entry Point: `BACKGROUND_NOTIFICATION_TASK` (notifications.ts)
   ▼
[handleNotificationResponse(response)] (notifications.ts)
   │  1. Extract payload: `data.medicationId`, `data.scheduledTime`
   │  2. Compute canonical key: `getCanonicalDoseId(medId, todayDate, schedTime)`
   ▼
[recordTaken(canonicalKey, todayDate, timestamp, medId, schedTime)] (sync.ts)
   │  1. Updates `STATUS_KEY_PREFIX:canonicalKey` = "taken" in AsyncStorage
   │  2. Updates `STATUS_KEY_PREFIX:(medId, schedTime)` = "taken" (dual-key alignment)
   │  3. Cancels pending 30-minute missed-dose escalation notification
   ▼
[api.setDoseStatus(canonicalKey, "taken")] (api.ts)
   │  Attempt network POST to `/api/doses/{id}/status`
   ├── (Success) ──► Server updates `db.doses` and recalculates streak
   └── (Offline/Fail) ──► `enqueueWrite("doseStatus", ...)` (sync.ts offline queue)
   ▼
[UI Rerender on Foreground Resume] (today.tsx)
   │  `synthesizeDosesForDate` queries `recordDoseStatus`
   │  Local state immediately reflects "taken" — zero lag, zero server round-trip required.
```

---

## 2. Flow B: Local-First Multi-Device Authentication & Hydration

When a user logs in on a second device (Device B) with an existing account:

```
[User Login Screen] 
   │  User taps "Sign in with Google" or logs in with credentials
   ▼
[signInWithGoogle(credential)] (auth.ts)
   │  Calls backend `/auth/google` ──► receives JWT token & user profile
   │  Stores session in SecureStore: `auth_token`, `auth_user`
   ▼
[bootstrapUserDataset(todayDate)] (sync.ts)  <-- Critical Hydration Gate
   │  Calls `api.syncState(todayDate)` (GET /api/me/sync-state)
   ▼
[Cloud Run Backend: get_user_sync_state] (server.py)
   │  Executes 1 consolidated query aggregation:
   │  - User Profile & Caregivers
   │  - Active Medications
   │  - Doses for Today
   │  - Today's Hydration total & recent logs
   │  - Today's Completed Yoga steps
   │  - Current Adherence Streak
   ▼
[Atomic Cache Hydration in AsyncStorage] (sync.ts)
   │  `set(K.medications, res.medications)`
   │  `set(K.doses(todayDate), res.doses)`
   │  `set(K.water(todayDate), res.hydration.today_ml)`
   │  `set("yoga_done_{todayDate}", res.yoga.completed_step_nums)`
   │  `setLastSyncTimestamp(Date.now())`
   ▼
[Navigation: Router replaces route with /(tabs)/today]
   │  `useFocusEffect` in today.tsx checks `getLastSyncTimestamp()`
   │  Elapsed time < 5 minutes ──► SWR cache hit!
   │  Tabs mount instantly with zero spinner, zero redundant network calls.
```

---

## 3. Flow C: Autonomous Sentinel Agent Telemetry & Bug Audit

When an audit is executed or unhandled exception occurs:

```
[Mobile Exception / Crash]
   │  Captured by `PillCareErrorBoundary.componentDidCatch` (_layout.tsx)
   ▼
[api.reportCrash(crashData)] (api.ts)
   │  POST to `/api/analytics/crash` (server.py)
   ▼
[MongoDB Atlas] 
   │  Inserted into `db.crash_reports` with stack trace, device OS, app version
   ▼
[Sentinel Agent Ingestion] (agent/sentinel_agent.py)
   │  1. Aggregates crashes, notification tap vs dismiss ratios, sync queue drops
   │  2. Analyzes Cloud Run endpoint volume & cost hotspots
   │  3. Compiles Markdown Report & stores in `db.reports`
   ▼
[Chief of Engineering Delivery]
   │  Viewable in Admin Panel under Reports (`rep_04`) or curl `/admin/agent/run-telemetry-audit`
```
