# ROLLBACK: Emergency Reversal & Disaster Recovery Plan

> **Scope**: Safe recovery steps if a production release or AI code change introduces unexpected regressions.  
> **Rule**: Never deploy Lane B code without a verified rollback path.

---

## 1. Fast Rollback via Git

- **Last Known Good Commit**: Check `git log -n 5` before deploying risky changes.
- **Rollback Command**:
  ```bash
  # Revert the specific commit while preserving history
  git revert <commit-sha> -m 1
  ```
- **Files Touched in Notification & Sync Upgrade**:
  - `frontend/src/lib/notifications.ts`
  - `frontend/src/lib/sync.ts`
  - `frontend/src/lib/auth.ts`
  - `frontend/app/(tabs)/today.tsx`
  - `frontend/app/(tabs)/yoga.tsx`
  - `frontend/app/_layout.tsx`
  - `backend/server.py`
  - `backend/agent/sentinel_agent.py`

---

## 2. Dynamic Kill-Switches & Feature Flags

If a specific component causes issues in production without needing a full app re-submission to Google Play / App Store:

1. **Background Notification Task Kill-Switch**:
   - In `notifications.ts`, if headless task execution causes memory issues on low-end Android devices, the task handler wraps all execution in `try / catch` and logs warnings without crashing the app process.
2. **SWR Cache Bypass**:
   - Users can pull-to-refresh on the Today tab at any time to bypass the 5-minute SWR TTL cache and force a fresh network fetch from `/api/me/sync-state`.
3. **Consolidated Sync State Fallback**:
   - If `/api/me/sync-state` experiences backend downtime, `sync.ts` gracefully falls back to individual entity fetching (`listMedications`, `listDoses`, `getWaterStatus`).

---

## 3. Post-Rollback Verification Checklist

After executing a rollback:
1. Run `npx tsc --noEmit` in `frontend/`.
2. Verify `/health` on backend returns `{"status": "ok"}`.
3. Verify that existing local user storage in AsyncStorage is not corrupted.
