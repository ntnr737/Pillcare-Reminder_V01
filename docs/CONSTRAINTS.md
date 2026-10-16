# CONSTRAINTS: System Boundaries & Off-Limits Invariants

> **Audience**: AI assistants, contractors, core developers.  
> **Rule**: Hard constraints written with **NEVER**, **ALWAYS**, and **ONLY**. You must STOP and ask for explicit confirmation before altering any rule listed below.

---

## 1. Protected Areas (No Unsupervised Edits)

1. **Authentication & Identity (`frontend/src/lib/auth.ts`, `backend/server.py` `/auth/*`)**:
   - **NEVER** loosen JWT token validation, shorten password salt hashing, or expose Google OAuth client secrets.
   - **ALWAYS** preserve guest migration to authenticated user workflows.
2. **Payments & Subscriptions (`backend/server.py` `/payments/*`, `frontend/src/lib/api.ts` `verifyPayment`)**:
   - **NEVER** modify Razorpay/Stripe verification webhooks without crypto signature validation (`hmac.sha256`).
   - **NEVER** grant premium entitlement without server-side verification.
3. **Clinical Medication Pacing & Schedules**:
   - **NEVER** trigger un-throttled notification loops (< 15 minutes) for missed doses. Notification fatigue causes users to disable OS notifications entirely.
   - **ALWAYS** adhere to clinical pacing standards: 30-minute missed medication follow-up (Apple Health standard) and 90-minute hydration intervals (gastric clearance rate).
4. **Offline Local-First Storage (`frontend/src/lib/sync.ts`)**:
   - **ALWAYS** record user actions (`recordTaken`, `recordSkipped`, `recordWater`) locally first with immediate UI state reflection before hitting the network.
   - **NEVER** allow server responses to overwrite a user's local optimistic `taken` or `skipped` status with a stale server `pending` status.
5. **Infrastructure & Cloud Run Billing**:
   - **NEVER** introduce polling intervals faster than 5 minutes (`300000ms`) for background telemetry or non-critical data.
   - **NEVER** fire multiple un-cached server fetches upon screen focus without an SWR TTL check.
   - **ALWAYS** use consolidated sync endpoints (`/api/me/sync-state`) rather than chaining individual entity requests.

---

## 2. Code & Dependency Constraints

- **ONLY** install new npm or pip packages after explicitly explaining why no existing library suffices, who maintains the package, and its bundle size impact.
- **NEVER** hardcode API keys, JWT secrets, MongoDB connection strings, or external endpoints in source files. All secrets belong in environment variables (`.env`).
- **NEVER** bypass TypeScript compilation (`npx tsc --noEmit`) or skip type errors using `// @ts-ignore` or `any` unless strictly unavoidable for legacy library wrappers.
- **NEVER** run `git push --force` or rewrite published git history.
- **ALWAYS** keep `BACKGROUND_NOTIFICATION_TASK` defined at top-level module scope in `notifications.ts`. Moving it inside a React component or hook breaks OS background intent execution.
