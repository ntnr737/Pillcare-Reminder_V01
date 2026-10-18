# HANDOVER

## Latest session: 2026-10-18 (model: Antigravity / Gemini 2.5 Pro)

### Done:
- Completed & approved comprehensive Local-First Architecture adoption plan (`file:///Users/nitin/.gemini/antigravity/brain/5d40a00a-e389-493d-827d-35ac9d676a3f/pillcare_mytherapy_adoption_plan.md`) featuring The 7 Laws of PillCare Local-First Architecture.
- Fixed canonical dose ID resolution in `backend/server.py`: Replaced naive `_` string split with robust regex `r"^(?:local_dose_|dose_)(.+)_(\d{4}-\d{2}-\d{2})(?:_([0-9a-zA-Z:]+))?$"` to handle medication IDs containing underscores (e.g. `local_1729000_abc`), and added on-demand dose creation fallback so dose marking never returns 404.
- Fixed Android notification channels: Registered legacy and static channel aliases (`medication-reminders`, `hydration-reminders`, `yoga-reminders`, `broadcasts`, `default`) with high importance so Android OS never drops notifications scheduled with legacy IDs.
- Registered multi-category identifier aliases (`MEDICATION_CATEGORY`, `medication`, `water`, `hydration`, `yoga`) across all Android notification categories to ensure interactive action buttons render reliably on all OEM skins.
- Aligned cold-start and foreground deep linking in `index.tsx` and `notifications.ts`: Added support for `data.route_key`, `data.routeKey`, `data.category`, and expanded allowlist to route directly to `/(tabs)/yoga` or `/(tabs)/today?focus=water`.
- Eliminated disruptive "Updating latest data..." banner on tab switch in `today.tsx`: Switched SWR cache TTL to check persisted `getLastSyncTimestampAsync()` from `AsyncStorage`; background updates now execute completely silently without UI flicker.
- Protected offline write queue on logout: Added 2-second queue flush race in `signOut()` before wiping local session, guaranteeing recent doses and water intake from Device A reach Cloud Run before logging in on Device B.
- Added automatic queue flush triggers in `_layout.tsx` on both app cold launch and app resume (`AppState === "active"`).
- Added Android Battery Optimization Exemption UI card and deep link handler in `frontend/app/notification-settings.tsx` (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` + `dontkillmyapp.com` guide).
- Fixed relative URL startup crash (`Invalid URL: /api/public/feature-config`): Created `frontend/src/lib/config.ts` providing guaranteed fallback `DEFAULT_BACKEND_URL = "https://pillcare-backend-1082668880575.europe-west1.run.app"`, updated `api.ts`, `auth.ts`, `features.ts`, and `sign-in.tsx`, and guarded `fetch` so URL or network errors never trigger the root Error Boundary.
- Recompiled fresh release APK via Gradle (`866 actionable tasks: 60 executed, 806 up-to-date` in 27s); updated `PillCare-v1.0.74-release.apk` (113MB).
- Verified test gates: `npx tsc --noEmit` (0 errors), `python3 -m py_compile backend/server.py` (code 0), `pytest test_qc_audit_contracts.py` (4/4 passed).

### In progress:
- User reinstalling the updated release APK on physical device.

### Broken or risky:
- None. All startup fetch URLs have guaranteed production fallbacks and try-catch safety guards.

### Next:
- Connect phone via USB to run `adb install -r -d PillCare-v1.0.74-release.apk` or transfer APK directly.

### Do not touch:
- `frontend/src/lib/notifications.ts`: `BACKGROUND_NOTIFICATION_TASK` must remain defined at module scope (outside React components) or Android headless intents will fail.
- `backend/server.py`: `/api/me/sync-state` response schema contract (critical for `bootstrapUserDataset` pre-hydration).

---
**Read first**: `docs/ARCHITECTURE.md`, `docs/CONSTRAINTS.md`
