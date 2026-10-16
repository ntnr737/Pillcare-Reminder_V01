# DATA: Schemas, Data Structures & Access Patterns

> **Scope**: Core client and server data structures, storage shapes, access patterns, and sizing.  
> **Key Insight**: Knowing why a data structure fits the access pattern is mandatory for passing the Whiteboard Defense.

---

## 1. Core Data Structures

### A. Canonical Dose Key (`canonicalDoseId`)
- **Structure**: String tuple: `local_dose_{medicationId}_{YYYY-MM-DD}_{HH:mm}`
- **Access Pattern**: Exact $O(1)$ key-value lookup in local `AsyncStorage` and MongoDB query `_id` / `canonical_id`.
- **Expected Size**: ~40 bytes per dose record.
- **Trade-off**: Slightly redundant string format in exchange for 100% deterministic offline generation on device without requiring server ID allocation.
- **Writers**: Mobile `notifications.ts` (background actions), `today.tsx` (UI actions), `sync.ts` (pre-hydration).
- **Readers**: Mobile `today.tsx`, `progress.tsx`, backend `server.py` `/api/doses/*`.

### B. Dual-Key Local Status Registry (`STATUS_KEY_PREFIX`)
- **Structure**: Two simultaneous key paths:
  1. `dose_status_override:{canonicalDoseId}` -> `{"status": "taken" | "skipped", "timestamp": ISO}`
  2. `dose_status_override:tuple:{medicationId}:{HH:mm}` -> `{"status": "taken" | "skipped", "timestamp": ISO}`
- **Access Pattern**: High-frequency read on every dose card render; written when user taps confirmation.
- **Expected Size**: ~80 bytes per entry; purged automatically after 30 days.
- **Trade-off**: Double write per action in exchange for matching both canonical IDs and loose `(medId, time)` tuples if a remote push lacked full date context.
- **Writers**: `recordTaken`, `recordSkipped` in `sync.ts`.
- **Readers**: `recordDoseStatus`, `mergeDoses`, `synthesizeDosesForDate`.

### C. Atomic Sync State Document (`/api/me/sync-state`)
- **Structure**:
  ```json
  {
    "user_id": "string",
    "profile": { "name": "...", "caregiver_phone": "..." },
    "medications": [ { "id": "...", "name": "...", "times": [...] } ],
    "doses": [ { "id": "...", "status": "taken" | "pending" | "skipped" } ],
    "hydration": { "today_ml": 1750, "target_ml": 2500, "logs": [...] },
    "yoga": { "completed_step_nums": [1, 2, 3] },
    "streak": { "current_streak": 7, "freeze_days_remaining": 1 },
    "server_time": "2026-10-16T08:00:00Z"
  }
  ```
- **Access Pattern**: Read once on login (pre-hydration) and at most once every 5 minutes (SWR TTL) on tab focus.
- **Expected Size**: 2KB to 5KB (gzipped).
- **Trade-off**: Backend must perform a single multi-collection aggregation in exchange for eliminating 5 extra HTTP connections and round-trip handshakes.
- **Writers**: FastAPI `server.py` aggregating from `db.users`, `db.medications`, `db.doses`, `db.activities`.
- **Readers**: Mobile `sync.ts` `bootstrapUserDataset`.

### D. Offline Sync Queue (`sync_queue`)
- **Structure**: Array of mutation objects stored in `AsyncStorage`:
  ```json
  [
    {
      "id": "write_1729050000_1234",
      "type": "doseStatus" | "waterLog" | "yogaComplete",
      "payload": { ... },
      "queuedAt": "2026-10-16T08:00:00Z",
      "attempts": 1
    }
  ]
  ```
- **Access Pattern**: FIFO queue. Append on mutation failure; flushed sequentially when network connectivity resumes.
- **Expected Size**: Typically 0 to 10 items (< 5KB).
- **Trade-off**: Local disk writes on failed requests prevent data loss during network blips.
- **Writers**: `enqueueWrite` in `sync.ts`.
- **Readers**: `flushSyncQueue` in `sync.ts`.
