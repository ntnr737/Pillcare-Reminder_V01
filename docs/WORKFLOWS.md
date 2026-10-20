# PillCare - Complete Application Workflows Reference Manual

> **Purpose**: Definitive, end-to-end architectural and operational guide mapping all user and system execution paths in the PillCare ecosystem.  
> **Audience**: AI Agents, Engineers, QA Leads, and the Chief of Engineering.  
> **Key Principle**: Every user action must be traceable from the UI trigger or OS hardware intent down to local storage, background queues, and Cloud Run MongoDB records.

---

## Table of Workflows

1. [Workflow 1: Interactive Notification Shade Bar Actions (Zero-Lag Headless Execution)](#workflow-1-interactive-notification-shade-bar-actions)
2. [Workflow 2: Exact Alarm Scheduling & Clinical Pacing Cadence](#workflow-2-exact-alarm-scheduling--clinical-pacing-cadence)
3. [Workflow 3: The 7 Laws of PillCare Local-First Synchronization Engine](#workflow-3-the-7-laws-of-pillcare-local-first-synchronization-engine)
4. [Workflow 4: Offline Durable Mutation Queue & Pre-Signout Draining](#workflow-4-offline-durable-mutation-queue--pre-signout-draining)
5. [Workflow 5: Today Dashboard Silent SWR Hydration & Cache Invalidation](#workflow-5-today-dashboard-silent-swr-hydration--cache-invalidation)
6. [Workflow 6: Renal-Safe Hydration Tracking & Pacing Lockout](#workflow-6-renal-safe-hydration-tracking--pacing-lockout)
7. [Workflow 7: AI Yoga Therapy & Guided Flow Deep-Link Routing](#workflow-7-ai-yoga-therapy--guided-flow-deep-link-routing)
8. [Workflow 8: Medication Inventory Management & Refill Warnings](#workflow-8-medication-inventory-management--refill-warnings)
9. [Workflow 9: Android Battery Optimization Exemption & OEM Doze Bypass](#workflow-9-android-battery-optimization-exemption--oem-doze-bypass)
10. [Workflow 10: Server Cloud Run Cost Optimization & Polling Throttling](#workflow-10-server-cloud-run-cost-optimization--polling-throttling)
11. [Workflow 11: Autonomous Sentinel Agent Telemetry & Bug Triage](#workflow-11-autonomous-sentinel-agent-telemetry--bug-triage)
12. [Workflow 12: 5-Stage Local & CI/CD Native Release Build Pipeline](#workflow-12-5-stage-local--cicd-native-release-build-pipeline)

---

## Workflow 1: Interactive Notification Shade Bar Actions

Enables patients to confirm medications, skip doses, or log water intake directly from their lock screen or Android notification shade without opening or foregrounding the app.

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant OS as Android Notification Shade
    participant TM as expo-task-manager (Headless)
    participant Store as AsyncStorage (Local DB)
    participant Queue as Durable Mutation Queue
    participant Cloud as Cloud Run Backend

    Note over OS: Scheduled Time (e.g., 08:00 AM)
    OS->>Patient: Displays High-Priority Heads-Up Banner<br/>[ ✓ Taken ] [ ✕ Skip ] [ ⏱ 10 Min ] [ ⏱ 1 Hour ]
    
    alt Patient taps "✓ Taken"
        Patient->>OS: Taps "✓ Taken" (Action: MARK_TAKEN)
        OS->>TM: Dispatches Headless Intent (BACKGROUND_NOTIFICATION_TASK)
        TM->>Store: recordTaken(canonicalKey) < 10ms
        TM->>Store: Cancel +30m Missed-Dose Fallback
        TM->>Queue: enqueueWrite("doseStatus", { status: "taken", med_id, time })
        TM-->>OS: Dismiss Notification Banner
        
        opt Network is Available
            Queue->>Cloud: POST /api/doses/mark-taken-by-medication
            Cloud-->>Queue: HTTP 200 OK (Streak & Dose Updated)
        end
    else Patient taps "⏱ 10 Min"
        Patient->>OS: Taps "⏱ 10 Min" (Action: SNOOZE_10)
        OS->>TM: Dispatches Headless Intent
        TM->>OS: Schedules Exact One-Shot Alert at T + 600s
        TM-->>OS: Dismisses Current Notification
    else Patient taps "✕ Skip"
        Patient->>OS: Taps "✕ Skip" (Action: SKIP)
        OS->>TM: Dispatches Headless Intent
        TM->>Store: recordDoseStatus(canonicalKey, "skipped") < 10ms
        TM->>Queue: enqueueWrite("doseStatus", { status: "skipped" })
        TM-->>OS: Dismiss Notification
    end
```

### Key Implementation Invariants:
1. **Module-Scope Task Registration**: The headless task `BACKGROUND_NOTIFICATION_TASK` in [`frontend/src/lib/notifications.ts`](../frontend/src/lib/notifications.ts) MUST remain registered outside React component render trees.
2. **Sub-10ms Local Execution**: Tapping an action writes synchronously into `AsyncStorage` using `recordTaken()`. The patient does not wait for HTTP requests.
3. **Escalation Cancellation**: Marking taken immediately cancels any pending secondary alerts scheduled for 30 minutes later.

---

## Workflow 2: Exact Alarm Scheduling & Clinical Pacing Cadence

Adheres to gold-standard clinical reminder guidelines modeled after MyTherapy and Apple Health.

```mermaid
flowchart TD
    A[Medication Scheduled e.g. 08:00 AM] --> B[Calculate Trigger Time]
    B --> C{Alarm Type?}
    C -->|Medication| D[Schedule Exact Alarm on Channel: medication-reminders]
    C -->|Water| E[Schedule Pacing Notification on Channel: hydration-reminders]
    C -->|Yoga| F[Schedule 08:00 AM Bell on Channel: yoga-reminders]

    D --> G[Schedule +30m Escalation Missed-Dose Reminder]
    
    G --> H{User Action within 30m?}
    H -->|Action Taken / Skipped| I[Cancel +30m Escalation Alarm Immediately]
    H -->|No Action Recorded| J[Fire Urgent Reminder Sound 3 / Siren]
```

### Android Notification Channel Configuration:
- `medication-reminders`: Importance `MAX`, sound enabled, custom vibration `[0, 500, 250, 500]`, lockscreen visibility `PUBLIC`.
- `hydration-reminders`: Importance `HIGH`, gentle water droplet sound.
- `yoga-reminders`: Importance `MAX`, peaceful Tibetan bell chime.
- `broadcasts`: Importance `MAX`, administrative and clinical announcements.

---

## Workflow 3: The 7 Laws of PillCare Local-First Synchronization Engine

```mermaid
flowchart LR
    subgraph Client ["Client Device (Untrusted Network / Offline-First)"]
        UI["React Native Screens\n(Today, Treatment, Yoga)\n- Zero UI Spinners\n- Instant < 10ms Hydration"]
        LOCAL[("AsyncStorage Local DB\n- pc6_medications\n- pc6_doses_YYYY-MM-DD\n- pc6_water_YYYY-MM-DD\n- pc6_dose_status_YYYY-MM-DD\n- pc6_last_sync_timestamp")]
        QUEUE[("Durable Mutation Queue\n(pc6_write_queue)\n- Atomic journal\n- Deduplication\n- Backoff retry")]
    end

    subgraph Cloud ["Google Cloud Run (FastAPI + MongoDB)"]
        SYNC["GET /api/me/sync-state\n(Single Consolidated Snapshot ~3KB)"]
        RESOLVE["POST /api/doses/{id}/status\n(Regex Parser + On-Demand Creation)"]
    end

    UI <-->|Sub-millisecond Read/Write| LOCAL
    UI -->|Enqueue Mutation| QUEUE
    LOCAL <-->|5-Minute SWR Cache Check| SYNC
    QUEUE -->|Background Draining| RESOLVE
```

### The 7 Laws:
1. **Local State is Single Source of Truth**: UI renders strictly from `AsyncStorage`. Blocking network calls before screen mount are prohibited.
2. **Local Taken Always Wins**: If local registry has `taken` or `skipped`, it overrides server `pending` status during [`mergeDoses()`](../frontend/src/lib/sync.ts).
3. **Durable Mutation Queue (`pc6_write_queue`)**: Mutations are journaled to disk before dispatch. Retries survive app kills.
4. **Pre-Signout Queue Drain**: [`signOut()`](../frontend/src/lib/auth.ts) races a 2-second queue flush before clearing local credentials, preventing Device A ➔ Device B data loss.
5. **Atomic Delta Hydration**: Login and catch-up use `GET /api/me/sync-state` (~3KB gzip) to populate all local tables in one single payload.
6. **Persisted SWR Cache TTL**: `lastSyncTimestamp` is stored in `AsyncStorage`. Tab switches check local TTL (5-minute window). No network call is made if data is fresh. Background syncs hide the loading spinner.
7. **Event-Sourced Hydration Merging**: Water intake is stored as discrete timestamped events (`{ amount, ts }`) rather than a single overwritable number.

---

## Workflow 4: Offline Durable Mutation Queue & Pre-Signout Draining

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Screen as UI Component
    participant Sync as sync.ts (Mutation Engine)
    participant Storage as AsyncStorage (pc6_write_queue)
    participant API as Cloud Run Backend

    User->>Screen: Marks Dose Taken / Logs Water
    Screen->>Sync: enqueueWrite(type, payload)
    Sync->>Storage: Append / Deduplicate in pc6_write_queue
    Sync->>Screen: Return Immediately (Optimistic UI Update)

    loop Background Auto-Flush (Cold Start / AppState Active / Online)
        Sync->>Storage: Read pending items
        alt Queue has items & Online
            Sync->>API: Dispatch Mutation (e.g., POST /api/doses/mark-taken-by-medication)
            alt HTTP 200 OK
                Sync->>Storage: Remove item from pc6_write_queue
            else HTTP 4xx Permanent Failure
                Sync->>Storage: Drop item to avoid head-of-line blocking
            else Network Error / 5xx
                Sync->>Storage: Increment retry_count & apply exponential backoff
            end
        end
    end

    opt User Taps "Sign Out"
        User->>Sync: signOut()
        Sync->>Sync: Promise.race([flushQueue(), timeout(2000)])
        Sync->>Storage: Clear local session after queue drained
    end
```

---

## Workflow 5: Today Dashboard Silent SWR Hydration & Cache Invalidation

Eliminates annoying `"Updating latest data..."` UI flickers and cuts Cloud Run server invocations by over 83%.

```mermaid
flowchart TD
    A[User Opens / Switches to Today Tab] --> B[hydrateFromLocalCache: Instant Display in < 10ms]
    B --> C[Read pc6_last_sync_timestamp from AsyncStorage]
    C --> D{Now - LastSync > 5 Minutes?}
    D -->|No: Cache is Fresh| E[Zero Network Calls - UI Remains Stable]
    D -->|Yes: Cache Expired| F[Trigger Background SWR Refresh]
    F --> G[Silently Fetch GET /api/me/sync-state without Displaying Spinner]
    G --> H[Update AsyncStorage & Seamlessly Re-render UI]
```

---

## Workflow 6: Renal-Safe Hydration Tracking & Pacing Lockout

Protects patient kidney health by enforcing the World Health Organization (WHO) and clinical nephrology pacing limits.

```mermaid
flowchart TD
    A[Patient Logs Water Intake: e.g. 250 mL] --> B[Check Hourly Consumption Total]
    B --> C{Total in Past 60m > 1,000 mL?}
    C -->|Yes| D[Trigger Renal Over-Hydration Warning Banner]
    C -->|No| E[Record Water Intake Event with Timestamp]

    E --> F{Logged Amount?}
    F -->|250 mL| G[Engage 15-Minute Pacing Lockout Timer]
    F -->|500 mL| H[Engage 30-Minute Pacing Lockout Timer]

    G --> I[Lock Water Buttons with Countdown Display]
    H --> I
    I --> J[Timer Expires: Unlock Buttons & Notify Patient]
```

---

## Workflow 7: AI Yoga Therapy & Guided Flow Deep-Link Routing

Integrates daily wellness routines verified by Ministry of AYUSH & Swami Ramdev guidelines.

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant Shade as Notification Shade
    participant Router as Expo Router (index.tsx / _layout.tsx)
    participant Yoga as Yoga Screen (yoga.tsx)
    participant Store as AsyncStorage / Cloud Run

    Note over Shade: 08:00 AM Scheduled Yoga Alert
    Shade->>Patient: "AI Yoga Therapy: Daily Anulom Vilom & Pawanmuktasana"
    Patient->>Shade: Taps Notification Body
    Shade->>Router: Launch App with intent data: { category: "yoga", route_key: "/(tabs)/yoga" }
    Router->>Yoga: Deep-Link directly to Yoga Screen (bypass Today tab redirect)
    Yoga->>Patient: Displays Pose Routine with Breath Timer & Instructions
    Patient->>Yoga: Taps "✓ Mark Pose Complete"
    Yoga->>Store: Save completed_step_num to local & queue sync
    Yoga->>Patient: Plays Completion Chime & Increments Daily Streak
```

---

## Workflow 8: Medication Inventory Management & Refill Warnings

Prevents dangerous medication stockouts for chronic conditions.

```mermaid
flowchart TD
    A[Dose Marked as Taken] --> B[Decrement Medication Current Stock: stock = stock - dose_qty]
    B --> C{Current Stock <= Refill Threshold?}
    C -->|No| D[Record Updated Stock in AsyncStorage & Queue Sync]
    C -->|Yes| E[Trigger Refill Alert Notification on Channel: broadcasts]
    E --> F[Display Red Warning Badge on Medication Card]
    F --> G[Suggest Brand-to-Generic Affordable Alternative]
```

---

## Workflow 9: Android Battery Optimization Exemption & OEM Doze Bypass

Ensures aggressive OEM task managers (OnePlus OxygenOS, Oppo ColorOS, Xiaomi HyperOS, Samsung OneUI) do not suppress exact alarms.

```mermaid
flowchart TD
    A[User Enters Notification Settings Screen] --> B[Display 'Reliable Exact Alarms & Background Delivery' Card]
    B --> C[User Taps 'Disable Battery Limits']
    C --> D[Dispatch Intent: android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS]
    D --> E[Android System Settings: PillCare Set to 'Unrestricted']
    E --> F[Device Doze Mode Exempts PillCare Alarm Timers]
    B --> G[User Taps 'Device Guide']
    G --> H[Open Browser to dontkillmyapp.com with OEM-Specific Instructions]
```

---

## Workflow 10: Server Cloud Run Cost Optimization & Polling Throttling

```mermaid
flowchart TD
    subgraph Before_Optimization ["Before Optimization (High Cloud Billing)"]
        B1[Tab Switch Today ➔ Server Hit]
        B2[Tab Switch Treatment ➔ Server Hit]
        B3[App Resume ➔ Unconditional 60s Heartbeat]
        B4[Sign In ➔ 6 Parallel HTTP Requests]
    end

    subgraph After_Optimization ["After Optimization (> 83% Cost Reduction)"]
        A1[Tab Switch ➔ Check 5m Persisted SWR TTL (Zero Network if Fresh)]
        A2[App Resume ➔ Heartbeat Throttled to 15m Cooldown]
        A3[Sign In ➔ Single Consolidated GET /api/me/sync-state (~3KB gzip)]
    end
```

---

## Workflow 11: Autonomous Sentinel Agent Telemetry & Bug Triage

Continuous health monitoring designed for the Chief of Engineering.

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App Runtime
    participant Backend as Cloud Run (server.py)
    participant DB as MongoDB Atlas
    participant Sentinel as Sentinel Agent (sentinel_agent.py)
    actor Chief as Chief of Engineering

    App->>Backend: POST /api/analytics/crash (Captured unhandled errors)
    App->>Backend: POST /api/analytics/event (Action tap vs dismiss ratios)
    Backend->>DB: Insert into db.crash_reports & db.analytics_events
    
    Note over Sentinel: Automated Audit Schedule / Admin Trigger
    Sentinel->>DB: Scan crash signatures, queue drops, and Cloud Run volumes
    Sentinel->>Sentinel: Formulate Root Cause Analysis (RCA) & Remediation Steps
    Sentinel->>DB: Write Markdown Report to db.reports
    Chief->>Backend: GET /admin/agent/latest-report
    Backend-->>Chief: Displays Executive Diagnostic Report & Action Checklist
```

---

## Workflow 12: 5-Stage Local & CI/CD Native Release Build Pipeline

Guarantees reproducible, crash-free standalone release APKs.

```mermaid
flowchart TD
    A[Stage 1: Remote Sync & Dependency Check] --> B[Stage 2: Pre-Flight Static Type Gate]
    B --> C[Stage 3: Toolchain & Environment Pinning]
    C --> D[Stage 4: Hermes Bytecode & Gradle Release Build]
    D --> E[Stage 5: Post-Build Integrity & Metadata Verification]

    subgraph S1 [Phase 1: Code]
      A -.-> A1[git pull origin main]
      A -.-> A2[Verify native packages in node_modules]
    end
    subgraph S2 [Phase 2: Types]
      B -.-> B1[npx tsc --noEmit: 0 error guarantee]
    end
    subgraph S3 [Phase 3: Tools]
      C -.-> C1[JAVA_HOME: OpenJDK 17]
      C -.-> C2[ANDROID_HOME: SDK 36]
      C -.-> C3[DEFAULT_BACKEND_URL Fallback in config.ts]
    end
    subgraph S4 [Phase 4: Gradle]
      D -.-> D1[Metro Export: 2,040+ modules bundled]
      D -.-> D2[Hermes Bytecode Compilation]
      D -.-> D3[./gradlew assembleRelease --no-daemon]
    end
    subgraph S5 [Phase 5: Sanity]
      E -.-> E1[output-metadata.json: versionCode 74, v1.0.74]
      E -.-> E2[Payload Size: 113 MB]
      E -.-> E3[unzip -t: 0 CRC errors]
    end
```

---

## Cross-Reference Mapping

| Feature Area | Key Implementation Files | Primary Invariant |
| :--- | :--- | :--- |
| **Notification Shade Actions** | [`frontend/src/lib/notifications.ts`](../frontend/src/lib/notifications.ts) | Must execute at module scope in `< 10ms` without foregrounding app. |
| **Local-First Sync Engine** | [`frontend/src/lib/sync.ts`](../frontend/src/lib/sync.ts) | Local `taken` status always overrides server `pending` status. |
| **Centralized Config & URL Fallback** | [`frontend/src/lib/config.ts`](../frontend/src/lib/config.ts) | Guaranteed production backend URL prevents relative URL crashes. |
| **Offline Mutation Queue** | [`frontend/src/lib/sync.ts`](../frontend/src/lib/sync.ts) | Writes persisted to disk; drained before signout. |
| **Cloud Run API & Resolver** | [`backend/server.py`](../backend/server.py) | Regex parser resolves canonical dose IDs with on-demand dose synthesis. |
| **Autonomous Sentinel Agent** | [`backend/agent/sentinel_agent.py`](../backend/agent/sentinel_agent.py) | Automated daily diagnostics and crash triage for Chief Engineer. |
| **Release Build Configuration** | [`frontend/android/app/build.gradle`](../frontend/android/app/build.gradle) | Pinned to React Native 0.86, Expo SDK 57, Java 17, and Hermes. |
