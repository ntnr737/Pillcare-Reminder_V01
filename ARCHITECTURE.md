# Pillcare Reminder — Architecture Audit

Repository: `ntnr737/Pillcare-Reminder_V01`
Audit scope: full stack as currently deployed (backend, frontend, infra, secrets, third-party integrations).
This document describes what actually exists in the code today, not an idealized design.

---

## 1. System Overview

Pillcare is a single-user medication reminder app: a React Native (Expo) mobile client talking to a
FastAPI backend on Google Cloud Run, backed by MongoDB Atlas, with three external integrations
(Groq for AI, WasenderAPI for WhatsApp, Google Cloud Scheduler for the daily cron trigger).

```
┌─────────────────┐        HTTPS/JSON         ┌──────────────────────────────┐
│  Expo/React      │ ───────────────────────▶ │  FastAPI backend              │
│  Native app       │ ◀─────────────────────── │  (Cloud Run, europe-west1)    │
│  (frontend/)       │                          │  backend/server.py            │
└─────────────────┘                            └───────────┬──────────────────┘
        │                                                     │
        │ local notifications                                 │ motor (async pymongo)
        │ (expo-notifications)                                ▼
        │                                        ┌──────────────────────────────┐
        │                                        │  MongoDB Atlas (M0)           │
        │                                        │  db: pillcare                 │
        │                                        └──────────────────────────────┘
        │
        │                                        ┌──────────────────────────────┐
        │                                        │  Groq API                     │
        │                                        │  text: openai/gpt-oss-120b    │
        │                                        │  vision: qwen/qwen3.6-27b     │
        │                                        └──────────────────────────────┘
        │
┌─────────────────┐     POST /caregiver/       ┌──────────────────────────────┐
│  Cloud Scheduler  │ ─────daily-report────────▶│  WasenderAPI (WhatsApp)       │
│  10 PM IST daily  │     (backend calls out)    │  send-message endpoint        │
└─────────────────┘                            └──────────────────────────────┘
```

There is no user authentication system despite `pyjwt`, `bcrypt`, and `passlib` being present in
`requirements.txt` — every endpoint operates on a single implicit profile with `id: "default"`.
This is a single-tenant personal app, not a multi-user product, as currently built.

---

## 2. Repository Layout

```
Pillcare-Reminder_V01/
├── backend/
│   ├── server.py            # entire backend — single file, 779 lines
│   ├── requirements.txt
│   ├── Dockerfile           # python:3.11-slim, uvicorn entrypoint
│   ├── .dockerignore
│   └── tests/
│       └── test_pillcare_backend.py
├── frontend/
│   ├── app/                 # expo-router file-based routing
│   │   ├── (tabs)/
│   │   │   ├── today.tsx        # home screen — doses, AI daily message
│   │   │   ├── treatment.tsx    # medications / measurements / activities / mood
│   │   │   ├── progress.tsx     # adherence charts
│   │   │   └── support.tsx
│   │   ├── _layout.tsx      # root layout — font load, analytics init, notification resync
│   │   ├── index.tsx        # entry redirect (onboarded? -> tabs : onboarding)
│   │   ├── onboarding.tsx   # 3-step profile setup wizard
│   │   ├── caregiver.tsx    # caregiver phone number + WhatsApp status card
│   │   ├── brand-generic.tsx
│   │   ├── scanner.tsx      # AI medication photo scanner UI
│   │   ├── history.tsx
│   │   └── privacy.tsx
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts           # single fetch wrapper, all backend calls
│   │   │   ├── notifications.ts # local push reminder scheduling
│   │   │   ├── firebase.ts      # analytics init
│   │   │   └── theme.ts         # design tokens
│   │   ├── components/
│   │   │   ├── AddMedicationSheet.tsx
│   │   │   ├── Charts.tsx
│   │   │   ├── ChipRow.tsx
│   │   │   ├── PrimaryButton.tsx
│   │   │   └── WeekStrip.tsx
│   │   └── hooks/use-icon-fonts.ts
│   ├── app.json              # Expo config — name, package/bundleId, icons, plugins
│   └── eas.json               # EAS build profiles (development/preview/production)
├── agent/                    # UNUSED — see §7
│   ├── chief_engineer.py
│   ├── monitor.py
│   └── tools.py
├── cloudbuild.yaml            # NOT USED — see §5.1
└── trigger.yaml                # local snapshot of the actual Cloud Build trigger config
```

---

## 3. Backend (`backend/server.py`)

Single-file FastAPI app. No routers split out, no service layer, no ORM — direct Motor
(async MongoDB driver) calls inside route handlers. All routes are mounted under `/api` via an
`api = APIRouter(prefix="/api")` include pattern (confirm exact prefix in file if extending).

### 3.1 Data model (Pydantic, mirrors MongoDB documents 1:1 — no migrations system)

| Model | Purpose | Key fields |
|---|---|---|
| `Profile` | The single user's identity + routine + caregiver contact | `id="default"`, `nickname`, `routine_wake/breakfast/lunch/dinner/sleep`, `caregiver_phone`, `notifications_enabled` |
| `Medication` | A tracked drug | `name`, `generic_name`, `dosage`, `unit`, `frequency_per_day`, `times: List[str]`, `active`, `stock`, `refill_threshold` |
| `DoseLog` | One scheduled instance of a medication on one day | `medication_id`, `date`, `scheduled_time`, `status: pending|taken|skipped|missed` |
| `Measurement` | Health readings (BP, glucose, etc.) | `type`, `value`, `value_secondary` (diastolic), `unit` |
| `Activity` | Logged wellness activities | `type`, `value`, `unit` |
| `MoodEntry` | Daily mood score | `score`, `note` |
| `CaregiverAlert` | Log entry for an outbound WhatsApp message | `message`, `phone`, `delivered_via` |

**Dose generation**: `DoseLog` rows are created lazily per-date by `_ensure_doses_for_date()`
(called from both `GET /doses` and `POST /caregiver/daily-report`), not pre-generated in bulk —
so doses only exist in the DB for dates that have actually been queried or reported on.

### 3.2 Full API surface (all under `/api`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health check — returns `{"message": "PillCare API ready"}` |
| GET | `/catalog/units` | Static dosage unit list |
| GET | `/catalog/measurements` | Static measurement type catalog |
| GET | `/catalog/activities` | Static activity type catalog |
| GET | `/profile` | Fetch the single profile doc |
| POST | `/profile` | Upsert profile (used by onboarding + settings) |
| GET | `/medications` | List medications (`?active=true` filter) |
| POST | `/medications` | Create medication; auto-resolves generic name via Groq if blank |
| GET | `/medications/{id}` | Fetch one |
| PATCH | `/medications/{id}` | Update (exists in API, **no frontend caller found** — see §7) |
| DELETE | `/medications/{id}` | Delete (same — no frontend caller found) |
| GET | `/doses` | List doses for a date (`?date_str=YYYY-MM-DD`); lazily generates them |
| POST | `/doses/{id}/status` | Mark a dose taken/skipped/missed |
| GET/POST/DELETE | `/measurements` | CRUD for health readings |
| GET/POST/DELETE | `/activities` | CRUD for activities |
| GET/POST | `/mood` | Mood log |
| GET | `/progress/adherence` | Adherence % + streak over N days (`?days=7`) |
| GET | `/ai/daily-message` | Groq-generated encouraging message (text model) |
| POST | `/resolve-generic` | Brand → generic name (Groq text model + local logic, see §4) |
| POST | `/scan-medication` | Photo → medication identification (Groq vision model) |
| POST | `/caregiver/alert` | One-off WhatsApp alert (used ad hoc, e.g. from UI actions) |
| GET | `/caregiver/log` | History of sent caregiver messages |
| POST | `/caregiver/daily-report` | **Cron-only** endpoint — generates + sends the 10 PM summary; guarded by `SCHEDULER_SECRET` query param |
| GET | `/export/csv` | CSV export of logged data |

### 3.3 Auth model

**None.** Every route is open (`--allow-unauthenticated` on Cloud Run). The only access control
in the entire backend is the `secret` query-param check on `/caregiver/daily-report`, which
exists solely to stop random internet traffic from triggering a WhatsApp send — it is not a real
auth mechanism. `pyjwt`/`bcrypt`/`passlib` in `requirements.txt` are unused dead weight.

---

## 4. AI Integration (Groq)

Three features, all routed through one internal helper, `_groq_chat()`, which POSTs directly to
`https://api.groq.com/openai/v1/chat/completions` via `httpx` (no SDK dependency).

| Feature | Endpoint | Model | Notes |
|---|---|---|---|
| Daily encouraging message | `GET /ai/daily-message` | `openai/gpt-oss-120b` | Falls back to a static templated string if `GROQ_API_KEY` is unset or the call fails |
| Brand → generic resolver | `POST /resolve-generic` | `openai/gpt-oss-120b` | **Known accuracy issue** — tested wrong on "Pan 40" (real: pantoprazole) with the original small model; migrated to `gpt-oss-120b` to improve this, not yet fully re-validated across a broad test set. "unknown" AI responses are normalized to `""` server-side so combination products (multivitamins) display cleanly instead of literally showing "unknown" |
| Medication photo scanner | `POST /scan-medication` | `qwen/qwen3.6-27b` | Vision-capable model; expects `image_base64` in request body; returns `{name, dosage, unit, confidence}` |

**Migration history**: originally used a third-party wrapper package (`emergentintegrations`,
calling Claude Sonnet under the hood) that isn't published to public PyPI, which was blocking
every Cloud Build. Rewritten to call Groq directly. Model names were further migrated from
`llama-3.1-8b-instant` / `llama-4-scout-17b-16e-instruct` to `openai/gpt-oss-120b` /
`qwen/qwen3.6-27b` after Groq deprecated the originals in mid-2026.

**Known gap**: no authoritative drug database (RxNorm/OpenFDA/local Indian brand map) backs the
resolver — it is 100% LLM recall, which is inherently unreliable for exact drug-identity facts.
Recommended and not yet implemented: a local `indian_drug_map.json` as primary lookup, Groq as
fallback only, with a "verify with pharmacist" disclaimer surfaced in the UI on AI-sourced answers.

---

## 5. Deployment Pipeline

### 5.1 Build & deploy — this is CLI/console-managed, not GitOps

`cloudbuild.yaml` exists in the repo root but **is not used**. The actual Cloud Build trigger
(`pillcare-backend-build`, id `da2da67c-98ff-4142-8d70-5a07c52bf472`) is a **Dockerfile-type**
trigger configured directly via `gcloud`/console, independent of any YAML in the repo. Its live
config (captured in `trigger.yaml`, itself just a local export snapshot, also not authoritative)
specifies:
- Dockerfile directory: `backend/` (this is also the Docker build context)
- Image: `gcr.io/pillcare-5fcac/pillcare-backend:latest`
- Service account: `1082668880575-compute@developer.gserviceaccount.com`
- `options.logging: CLOUD_LOGGING_ONLY` (required because a custom service account is set)
- `build.images` field present (required for the build to actually push, not just build)

Trigger fires on push to `main`. There is no staging environment — every push to `main` goes
straight to the production Cloud Run service on a successful build.

**Deploy is a separate manual step**, not automatic: a new image landing in the registry does
**not** redeploy Cloud Run by itself. Deployment requires an explicit:

```bash
gcloud run deploy pillcare-backend \
  --image gcr.io/pillcare-5fcac/pillcare-backend:latest \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars DB_NAME=pillcare \
  --set-secrets MONGO_URL=mongo-url:latest,GROQ_API_KEY=groq-api-key:latest,WASENDER_API_KEY=wasender-api-key:latest,SCHEDULER_SECRET=scheduler-secret:latest
```

This is a real operational gap: a merged PR does not go live until someone runs this command.

### 5.2 Secrets (Google Secret Manager — all correctly kept out of plaintext env vars)

| Secret name | Used for |
|---|---|
| `mongo-url` | MongoDB Atlas connection string |
| `groq-api-key` | Groq API auth |
| `wasender-api-key` | WasenderAPI auth (WhatsApp send) |
| `scheduler-secret` | Shared secret checked by `/caregiver/daily-report` |

All four are granted to the Cloud Run service account (`1082668880575-compute@...`) via
`roles/secretmanager.secretAccessor`, and wired into the running container via `--set-secrets`
at deploy time (not baked into the image).

### 5.3 Automated daily report (Cloud Scheduler)

Job `pillcare-daily-report` (region `asia-south1`), cron `0 22 * * *`, timezone `Asia/Kolkata`.
Fires an HTTP POST to `/api/caregiver/daily-report?secret=<scheduler-secret>` every day at
10:00 PM IST — independent of whether the app or anyone's phone is open.

### 5.4 Frontend build (EAS)

`eas.json` defines three profiles. `production` outputs an AAB (Play Store format);
`development`/`preview` output installable APKs directly (`buildType: apk`) for sideload testing.
`EXPO_PUBLIC_BACKEND_URL` must be present in each profile's `env` block — a local-only `.env`
file is **not** guaranteed to be picked up by an EAS cloud build, which was the root cause of a
production build hanging silently on the onboarding "save profile" step.

---

## 6. Frontend Data Flow

- `src/lib/api.ts` is the **only** place HTTP calls to the backend are made — a single `req<T>()`
  wrapper reading `EXPO_PUBLIC_BACKEND_URL` from the environment, with one exported method per
  backend endpoint. No React Query / SWR / caching layer — every screen calls `api.*` directly
  inside `useCallback` + `useFocusEffect` (expo-router) and holds results in local `useState`.
- No global state management (no Redux/Zustand/Context for app data) — each tab screen
  independently fetches what it needs on focus.
- `src/lib/notifications.ts` (`resyncReminders()`) does a **full teardown-and-rebuild** of all
  locally scheduled notifications every time it's called (on app launch, and after any medication
  is added from either the Today or Treatment screen) — it does not do incremental
  add/remove, it always calls `cancelAllScheduledNotificationsAsync()` then reschedules from the
  current `active` medication list. This is simple and correct but means every resync briefly
  clears all scheduled reminders before restoring them.
- **Push notifications require a native build** — Expo Go on Android cannot run this feature
  since Expo SDK 53 (a platform-level restriction, not a bug in this codebase); this only works
  in an EAS development/preview/production build.

---

## 7. Known Gaps, Dead Code, and Risk Areas

| Item | Status | Risk |
|---|---|---|
| `agent/` directory (`chief_engineer.py`, `monitor.py`, `tools.py`) | Present in repo, **never run** | If ever started, this autonomous agent (built on `google.antigravity`, targeting `gemini-3.5-flash`) is designed to read logs, patch source files, and auto-redeploy to production **with no human review step**. Left as-is it's inert, but the code enabling unsupervised production writes should not be run without adding a review/approval gate first. |
| `Medication` PATCH/DELETE endpoints | Backend implements them; **no frontend screen calls them** | Editing or deleting a medication is currently only possible via direct API call — there is no "edit medication" or "delete medication" UI |
| No authentication | Every endpoint is open | Acceptable for a single-user personal app on an unguessable Cloud Run URL; would need real auth before any multi-user use |
| `cloudbuild.yaml` in repo root | Dead file — the real trigger config lives outside git, in GCP directly | Misleading for anyone reading the repo expecting GitOps; either wire the trigger to actually use this file, or delete it to avoid confusion |
| Deploy is manual | Push to `main` only rebuilds the image, does not deploy it | A merged fix can sit un-deployed indefinitely without anyone noticing; consider a second Cloud Build step or Cloud Run's own "continuously deploy from repository" flow to close this gap |
| CORS: `allow_origins=["*"]` + `allow_credentials=True` | Works (Starlette reflects the actual origin rather than sending a literal wildcard) but is permissive | Fine for a mobile-only client (browsers don't enforce CORS against native apps); would need tightening if a web frontend is ever added |
| Brand→generic resolver accuracy | LLM-only, no authoritative database backing it | Already produced at least one verified wrong answer in testing; not safe to fully trust for medical identification as-is |
| `dosage: float` on `Medication` | Required field, no "no dosage applicable" concept until a recent fix relaxed the frontend's mandatory check | Combination products (multivitamins) can now save with a blank/zero dosage; the backend model still technically requires a float (defaults acceptable, just noting the constraint) |
| Package identity | Was `com.emergent.fullhandoff.oumduj` (a scaffold-tool placeholder, not owned by the developer) | Must be corrected before Play Store submission — cannot change post-publish |

---

## 8. Request Flow Example — Daily Caregiver Report (end to end)

This is the most cross-cutting feature in the system and touches every layer, useful as a
worked example of how the pieces fit together:

1. **Cloud Scheduler** (GCP, `asia-south1`) fires at 22:00 IST daily → HTTP POST to
   `pillcare-backend-1082668880575.europe-west1.run.app/api/caregiver/daily-report?secret=...`
2. **FastAPI** validates the `secret` query param against `SCHEDULER_SECRET` (Secret Manager)
3. Computes "today" in `Asia/Kolkata` (not server UTC — this matters, Cloud Run's clock is UTC)
4. Calls `_ensure_doses_for_date()` — lazily creates any missing `DoseLog` rows for today
5. Queries **MongoDB Atlas** for today's doses + the medications they reference
6. Builds a personalized message string (taken/missed/pending, with dosage formatting)
7. Calls `_send_whatsapp()` → **WasenderAPI** `POST /api/send-message` with the caregiver's phone
   number (read from the `Profile` document) and the message text
8. Logs the attempt (including delivery status: `wasender` / `mock` / `failed`) to the
   `caregiver_log` collection, independent of whether the send succeeded
9. Returns a JSON summary (used only for manual/debug testing via `curl`; the scheduler ignores
   the response body)

No component in this flow depends on the mobile app being open, installed, or even existing on
any device — it is entirely server + scheduler + third-party API.

---

## 9. Authentication & Multi-User Data Model (added post-audit)

The system described in §3.3 ("no auth, single implicit profile") has since been replaced with
real Google Sign-In and per-user data scoping. This section documents that change.

### 9.1 Backend — `POST /api/auth/google`

- Frontend obtains a Google **ID token** via `expo-auth-session/providers/google`, using the
  app's **native iOS/Android OAuth client IDs** (not the Web client ID — see §9.3 for why).
- Backend verifies the token with `google.oauth2.id_token.verify_oauth2_token()`, called with
  `audience=None` to skip the library's single-audience check, then manually validates the
  token's `aud` claim against `GOOGLE_VALID_AUDIENCES` — a set built from
  `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` env vars. This is
  necessary because the same app can legitimately present tokens issued under different client
  IDs depending on platform, and Google's library only supports checking against one.
- On first sign-in for a given Google `sub` (user id), a `User` document is created
  (`users` collection) and a JWT session token is issued (`pyjwt`, HS256, 90-day expiry,
  signed with `JWT_SECRET`).
- **One-time legacy data migration**: if this is the very first user ever to sign in (i.e.
  `users` collection was empty), `_migrate_legacy_default_data()` reassigns any pre-auth data —
  the old single `Profile` document (`id: "default"`) and every `Medication` / `DoseLog` /
  `Measurement` / `Activity` / `MoodEntry` / `CaregiverAlert` document missing a `user_id`
  field — to that new user's id. This is what makes existing personal-app data appear correctly
  once you sign in for the first time; it does not repeat for subsequent users.

### 9.2 Data scoping

Every collection except the static catalogs now carries a `user_id` field, and every route
requires a valid JWT via the `get_current_user_id` FastAPI dependency (reads
`Authorization: Bearer <token>`, decodes and verifies it, returns the `sub` claim as the acting
user's id). `Profile._id` doubles as the user id directly (one profile document per user, keyed
by their Google `sub`) rather than carrying a separate `user_id` field.

`POST /api/caregiver/daily-report` (the Cloud Scheduler cron target) is the one exception — it
has no per-request user context, since nothing is "logged in" when a cron job fires. It instead
loops over **every** `Profile` document that has a `caregiver_phone` set and sends a report for
each one, making the caregiver feature genuinely multi-user.

### 9.3 Frontend — why native client IDs, not the Web client ID

The first implementation tried using only the **Web application** OAuth client type, since it
gives full control over the redirect URI. This failed in production with
`Error 400: invalid_request` — Google's Web client type only accepts `https://` redirect URIs
and rejects custom URL schemes (`pillcare://`) outright, which is exactly what
`AuthSession.makeRedirectUri({ scheme: "pillcare" })` produces for a standalone/EAS build.

The fix: request the token using the app's **native iOS/Android client IDs** instead
(`Google.useAuthRequest({ iosClientId, androidClientId, webClientId, redirectUri })`). Native
client types are validated by app identity (bundle ID for iOS, package name + SHA-1 for
Android) rather than a redirect-URI allowlist, so a custom scheme works without any Google
Cloud Console changes. This is the RFC 8252-recommended pattern for public/native OAuth
clients. The Web client ID is still passed through and still accepted server-side (§9.1), kept
mainly for forward-compatibility (e.g. a future web build).

### 9.4 Session storage

The JWT and a lightweight cached `User` object are stored via `expo-secure-store` (Keychain on
iOS, EncryptedSharedPreferences on Android) through the existing `src/utils/storage.ts`
wrapper's `secureGet`/`secureSet`/`secureRemove` methods — not `AsyncStorage`, which is
unencrypted. `src/lib/api.ts`'s single `req()` wrapper reads the token on every call and
attaches `Authorization: Bearer <token>` automatically; a 401 response causes `app/index.tsx`
to clear the stored session and redirect to `/sign-in`.

### 9.5 Known follow-on effect

Because migration (§9.1) only runs on a *successful* sign-in, any period where sign-in is
broken or not yet attempted means existing legacy data stays unscoped and invisible to
user-scoped queries — including the daily caregiver report, which will report
"no medications scheduled" even if medications exist, simply because they aren't yet linked to
any account. This is expected transitional behavior, not a data-loss bug; it self-resolves the
moment the user completes one successful sign-in.

---

## 10. Branding Assets

The app was rebranded mid-project from generic Expo scaffold defaults to a "PillCare Reminder"
identity, including fixing an inherited placeholder package identity from the original
scaffolding tool.

### 10.1 Package / bundle identity

Originally `com.emergent.fullhandoff.oumduj` (an unowned template placeholder from whatever
tool scaffolded the project — left over, not something the developer registered). Changed to
`com.pillcare.reminder` for both `ios.bundleIdentifier` and `android.package` in `app.json`.
**This required corresponding updates in Google Cloud Console** — the OAuth iOS/Android client
IDs (§9.3) are bound to bundle ID / package name and had to be edited to match, or sign-in
fails with a mismatch even though the code itself is correct.

### 10.2 Icon/logo asset pipeline

Five distinct image assets exist for five distinct purposes — using the wrong one in the wrong
place is a recurring source of visual bugs (e.g. an opaque-background asset rendered inside the
app produces a visible box on the dark theme):

| File | Dimensions | Background | Used for |
|---|---|---|---|
| `assets/images/icon.png` | 1024×1024 | **Opaque white** (required — app stores don't allow transparency here) | The actual iOS home screen icon; Android fallback where adaptive icons aren't supported |
| `assets/images/adaptive-icon.png` | 1024×1024 | **Transparent** (composited onto `app.json`'s `adaptiveIcon.backgroundColor: "#000000"` at render time) | The actual **Android home screen icon** |
| `assets/images/logo-mark.png` | 1024×1024 | **Transparent** | In-app display only (currently the sign-in screen) — never used as a system icon |
| `assets/images/splash-image.png` | 337×286 (non-square by design) | Transparent, white wordmark | The launch splash screen (`expo-splash-screen` plugin config), scaled via `imageWidth` in `app.json` regardless of source dimensions |
| `assets/images/favicon.png` | 196×196 | Opaque white | Browser tab icon, web build only |

A white-background asset (`icon.png`) was initially reused directly inside the sign-in screen's
React component, producing a visible white square floating on the app's dark background —
`logo-mark.png` was created specifically to fix this, since it's the only asset with a genuinely
transparent background suitable for compositing over arbitrary in-app backgrounds.

### 10.3 Design decision: icon content

The team explicitly chose to use the **full logo lockup** (pill/heart mark + "PillCare" +
"REMINDER" wordmark) as the home-screen icon content, rather than the more conventional
mark-only icon. This is a deliberate tradeoff: wordmarks are typically illegible at real launcher
icon sizes (~48–108px), but brand recognizability was prioritized over that convention here.
