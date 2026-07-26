# PillCare Reminder — Architecture

**Repository:** `ntnr737/Pillcare-Reminder_V01`
**Last updated:** July 2026
**Status:** Production-ready MVP

---

## 1. System Overview

PillCare is a multi-user AI-powered medication reminder app. A React Native (Expo) mobile client talks to a FastAPI backend on Google Cloud Run, backed by MongoDB Atlas, with local-first offline architecture and background server sync.

```
┌─────────────────────────────────┐        HTTPS/JSON        ┌──────────────────────────────────┐
│   React Native (Expo SDK 54)    │ ───────────────────────▶ │   FastAPI Backend                 │
│   frontend/                     │ ◀─────────────────────── │   Cloud Run, europe-west1         │
│   Android (iOS-ready)           │                          │   backend/server.py (1095 lines)  │
└─────────────────────────────────┘                          └──────────────┬───────────────────┘
         │                                                                   │
         │  Local-first cache (AsyncStorage)                                 │ motor (async pymongo)
         │  Background sync queue                                            ▼
         │  expo-notifications (AndroidImportance.MAX)          ┌──────────────────────────────────┐
         │                                                       │   MongoDB Atlas M0               │
         │                                                       │   db: pillcare                   │
         │                                                       │   Collections:                   │
         │                                                       │   users, profile, medications,   │
         │                                                       │   doses, measurements, activities│
         │                                                       │   mood, appointments, caregiver  │
         │                                                       └──────────────────────────────────┘
         │
         │                                                       ┌──────────────────────────────────┐
         │                                                       │   Groq API                       │
         │                                                       │   - Daily AI insight message     │
         │                                                       │   - Yoga routine generation      │
         │                                                       │   - Brand→generic fallback       │
         │                                                       │   - Medication photo scanner     │
         │                                                       └──────────────────────────────────┘
         │
         │                                                       ┌──────────────────────────────────┐
         │                                                       │   OpenFDA API                    │
         │                                                       │   - Brand→generic (primary)      │
         │                                                       │   - api.fda.gov/drug/label.json  │
         │                                                       └──────────────────────────────────┘
         │
┌──────────────────────┐   POST /api/caregiver/    ┌──────────────────────────────────┐
│   Cloud Scheduler    │ ──daily-report──────────▶ │   WasenderAPI (WhatsApp)         │
│   10 PM IST daily    │   (backend triggers)       │   Caregiver missed-dose alerts   │
└──────────────────────┘                           └──────────────────────────────────┘
```

---

## 2. Repository Layout

```
Pillcare-Reminder_V01/
├── backend/
│   ├── server.py              # FastAPI app — all endpoints (1095 lines)
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Cloud Run container
│   └── tests/
│       └── test_pillcare_backend.py
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx        # Root layout, auth guard
│   │   ├── index.tsx          # Splash / redirect
│   │   ├── sign-in.tsx        # Google Sign-In screen
│   │   ├── onboarding.tsx     # 4-step onboarding (name, gender/YOB, GPS location, routine)
│   │   ├── caregiver.tsx      # Caregiver management screen
│   │   ├── scanner.tsx        # Prescription photo scanner
│   │   └── (tabs)/
│   │       ├── _layout.tsx    # Tab bar layout
│   │       ├── today.tsx      # Home: progress ring, doses, calendar, AI insight
│   │       ├── treatment.tsx  # Medications, measurements, activities, mood + yoga
│   │       ├── progress.tsx   # Adherence charts, dose history list
│   │       └── support.tsx    # Emergency helpline, WhatsApp, privacy, FAQ
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts         # All backend API calls with auth headers
│   │   │   ├── auth.ts        # Google Sign-In + JWT storage
│   │   │   ├── store.ts       # Local-first AsyncStorage cache layer
│   │   │   ├── sync.ts        # Background write queue + flush
│   │   │   ├── notifications.ts # Expo notifications, AndroidImportance.MAX
│   │   │   └── theme.ts       # Design tokens
│   │   └── components/
│   │       ├── AddMedicationSheet.tsx
│   │       ├── PrimaryButton.tsx
│   │       └── ...
│   ├── app.json               # Expo config, bundle ID: com.pillcare.reminder
│   ├── eas.json               # EAS build profiles (development/preview/production)
│   └── package.json
├── cloudbuild.yaml            # GCP Cloud Build trigger config
├── ARCHITECTURE.md            # This file
└── README.md
```

---

## 3. Backend — `backend/server.py`

### 3.1 Data Models (Pydantic, mirrors MongoDB 1:1)

| Model | Key Fields |
|---|---|
| `User` | id (Google sub), email, name, created_at |
| `Profile` | id, nickname, gender, year_of_birth, location_city, location_state, phone, routine_*, caregiver_phone, notifications_enabled |
| `Medication` | id, user_id, name, generic_name, dosage, unit, form, frequency, times[], stock, refill_threshold, active |
| `DoseLog` | id, user_id, medication_id, date, scheduled_time, status (pending/taken/skipped/missed), taken_at |
| `Measurement` | id, user_id, type, value, value_secondary, unit, note, recorded_at |
| `Activity` | id, user_id, type, value, unit, note, recorded_at |
| `MoodLog` | id, user_id, score (1-5), note, recorded_at |
| `Appointment` | id, user_id, doctor_name, specialty, phone, date, time, location, notes, reminder |

### 3.2 Full API Surface (all under `/api`)

**Auth**
- `POST /auth/google` — verify Google ID token, issue 90-day JWT, auto-migrate legacy data
- `GET /auth/me` — return current user

**Profile**
- `GET /profile` — get user profile
- `POST /profile` — upsert profile + IP geolocation fallback for location

**Catalog**
- `GET /catalog/units` — medication units
- `GET /catalog/measurements` — measurement types (BP, glucose, weight, BMI, SpO2, temp)
- `GET /catalog/activities` — activity types (steps, running, cycling, swimming, yoga, sleep)

**Medications**
- `GET /medications?active=true` — list medications
- `POST /medications` — create + auto-resolve generic name via OpenFDA → Groq fallback
- `GET /medications/{id}` — get one
- `PATCH /medications/{id}` — update
- `DELETE /medications/{id}` — delete

**Doses**
- `GET /doses?date_str=YYYY-MM-DD` — list doses for date (auto-generates if missing)
- `POST /doses/{id}/status` — update status (pending/taken/skipped/missed), decrements stock
- `GET /doses/history?days=30` — dose history grouped by date for Progress List tab

**Measurements / Activities / Mood**
- `GET/POST /measurements` — log and list measurements
- `DELETE /measurements/{id}`
- `GET/POST /activities` — log and list activities
- `GET/POST /mood` — log and list mood entries

**Appointments**
- `GET /appointments` — list doctor appointments
- `POST /appointments` — create appointment
- `PATCH /appointments/{id}` — update
- `DELETE /appointments/{id}` — delete

**Progress**
- `GET /progress/adherence?days=7` — daily pct[], streak, average

**AI**
- `GET /ai/daily-message` — Groq-generated insight based on adherence + medications
- `GET /yoga-tip` — Groq-generated yoga routine based on active medications (5 poses, AYUSH refs)
- `POST /resolve-generic` — OpenFDA primary → Groq fallback → returns generic name + source
- `POST /scan-medication` — Groq vision reads prescription image → returns structured med data

**Caregiver**
- `POST /caregiver/alert` — send WhatsApp alert to caregiver
- `GET /caregiver/log` — alert history
- `POST /caregiver/daily-report` — triggered by Cloud Scheduler, sends daily summary

**Export**
- `GET /export/csv` — download full health data as CSV

---

## 4. Drug Resolver

Two-layer lookup — OpenFDA is authoritative, Groq only as last resort:

```
Brand name entered
        │
        ▼
OpenFDA  api.fda.gov/drug/label.json?search=openfda.brand_name:{brand}
        │
        ├── Found → return generic_name (source: "openfda") ✅
        │
        └── Not found → Groq LLM fallback
                        │
                        ├── Found → return result (source: "groq_fallback")
                        └── Not found → return "" (source: "not_found")
```

FDA API key stored in Secret Manager as `fda-api-key`.

---

## 5. Authentication & Multi-User Data Model

### 5.1 Sign-in flow

```
User taps "Continue with Google"
        │
        ▼
@react-native-google-signin/google-signin (native SDK)
Shows in-app account picker (no browser redirect)
        │
        ▼
Returns Google ID token
        │
        ▼
POST /api/auth/google {id_token}
        │
        ▼
Backend verifies against GOOGLE_VALID_AUDIENCES
(Web + iOS + Android client IDs all accepted, audience=None)
        │
        ▼
Issues 90-day JWT signed with JWT_SECRET
        │
        ▼
Stored in AsyncStorage, sent as Bearer token on every request
```

### 5.2 Data scoping

Every collection document has `user_id` = Google `sub` (stable, unique). All queries filter by `user_id`. No user can access another user's data.

### 5.3 Android SHA-1

SHA-1 `14:B3:2E:08:23:1D:3C:93:8F:C7:9A:5B:15:98:50:8A:7C:B5:B8:5E` registered in Google Cloud Console. Managed by EAS keystore (`Build Credentials Zk0EOZuQ-0`).

---

## 6. Local-First Architecture

### Why
Backend is in `europe-west1` (Belgium). Users in India experience 150-500ms ping on every read. The app must feel instant.

### How it works

```
App opens
    │
    ▼
Read AsyncStorage cache (<50ms) → show data instantly
    │
    ▼
Background server fetch (doesn't block UI)
    │
    ▼
Update UI silently when server responds
    │
    ▼
Save fresh data to AsyncStorage for next open
```

### Write queue (offline support)

```
User marks dose / logs measurement
    │
    ▼
Update AsyncStorage + UI instantly (optimistic)
    │
    ▼
Enqueue write to server (store.ts → K.writeQueue)
    │
    ▼
sync.ts flushQueue() runs on every app foreground
    │
    ├── Online → send queued writes → dequeue on success
    └── Offline → keep in queue → retry next foreground
```

### Cache keys (`src/lib/store.ts`)
- `pc6_doses_{date}` — daily doses
- `pc6_profile` — user profile
- `pc6_streak` — current streak
- `pc6_medications` — medication list
- `pc6_measurements` — recent measurements
- `pc6_mood` — mood history
- `pc6_adherence_7d` — weekly adherence data
- `pc6_dose_history_30d` — 30-day dose history list
- `pc6_ai_msg` — cached AI daily message
- `pc6_yoga_tip` — cached yoga recommendation
- `pc6_write_queue` — pending server writes

---

## 7. Frontend Screens

### Today (home)
- Greeting header with PillCare logo + streak badge + calendar icon
- Overview card: "Your consistency is your strength" + progress ring (SVG, % of doses taken)
- Horizontal week strip (tap any day to browse history)
- Calendar modal: days colored green (≥80% taken), amber (50-79%), red (<50%)
- Morning / Afternoon / Evening / Night dose sections
- Each dose: **Take** button + **Missed** button (separate from Skip)
- AI Insight card (Groq daily message)
- FAB (+) opens Add Medication sheet

### Treatment
- 4-tab strip: Medications / Measurements / Activities / Mood
- **Medications**: filter tags (All/Active/Refill Soon), cards show brand + generic name + stock + schedule, "Refill Soon" badge, FAB action sheet
- **Yoga AI card**: Groq-generated routine based on actual medications, full detail modal with pose steps + AYUSH references
- **Measurements**: category chips to log, recent history list
- **Activities**: same pattern
- **Mood**: 5-emoji picker (😟😔😐😊😄) with color highlight, note field, history

### Progress
- Segmented control: Charts / List
- **Charts**: 7-bar adherence chart (green ≥80%, amber ≥50%, red <50%), 2-stat grid (streak + doses taken), AI recommendation card, Health Connect placeholder
- **List**: 30-day dose history grouped by date (Today/Yesterday/dates), each entry shows name, generic, status with color-coded icon

### Support
- Search bar
- 2×2 quick action grid (Call Doctor / Book Appointment / Emergency / My Profile)
- **Emergency Helpline**: GPS detects country → shows correct number (IN=112, US=911, UK=999, AU=000, RU=112, JP=119, DE=112, FR=15, CN=120 etc) → tap to call
- **WhatsApp Caregiver**: saves phone to backend profile, used by daily scheduler
- Privacy & Encryption expandable modal (4 sections)
- FAQ list with search
- Sign Out

---

## 8. Notifications

```
Channel: "medication-reminders"
Importance: AndroidImportance.MAX
Sound: default
Vibration: [0, 400, 200, 400]
LockscreenVisibility: PUBLIC

Schedule: DAILY trigger at each medication's scheduled times
resyncReminders() called on: app open, dose status change, medication add/edit
```

---

## 9. Deployment Pipeline

### Backend

```bash
# Build Docker image
gcloud builds triggers run pillcare-backend-build --branch=main

# Deploy to Cloud Run
gcloud run deploy pillcare-backend \
  --image gcr.io/pillcare-5fcac/pillcare-backend:latest \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars DB_NAME=pillcare,GOOGLE_WEB_CLIENT_ID=...,GOOGLE_IOS_CLIENT_ID=...,GOOGLE_ANDROID_CLIENT_ID=... \
  --set-secrets MONGO_URL=mongo-url:latest,GROQ_API_KEY=groq-api-key:latest,WASENDER_API_KEY=wasender-api-key:latest,SCHEDULER_SECRET=scheduler-secret:latest,JWT_SECRET=jwt-secret:latest,FDA_API_KEY=fda-api-key:latest
```

**GCP Project:** `pillcare-5fcac`
**Region:** `europe-west1`
**Service URL:** `https://pillcare-backend-1082668880575.europe-west1.run.app`
**Latest revision:** `pillcare-backend-00025-nmj`

### Secrets in Secret Manager

| Secret | Purpose |
|---|---|
| `mongo-url` | MongoDB Atlas connection string |
| `groq-api-key` | Groq AI API key |
| `wasender-api-key` | WhatsApp send API |
| `wasender-api-key` | WhatsApp send API |
| `scheduler-secret` | Cloud Scheduler auth token |
| `jwt-secret` | JWT signing key |
| `fda-api-key` | OpenFDA API key |

### Cloud Scheduler

Job: `pillcare-daily-report`
Schedule: `0 22 * * *` (10 PM IST = 16:30 UTC)
Region: `asia-south1`

### Frontend (EAS)

```bash
# Preview APK (for testing)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production
```

**EAS Account:** `pill-care`
**Bundle ID:** `com.pillcare.reminder`
**Scheme:** `pillcare`

---

## 10. Environment Variables

### Backend (Cloud Run env vars)
| Var | Value |
|---|---|
| `DB_NAME` | `pillcare` |
| `GOOGLE_WEB_CLIENT_ID` | `1082668880575-lfoqgnieodb52b5ges1vppiv92ifbioc.apps.googleusercontent.com` |
| `GOOGLE_IOS_CLIENT_ID` | `1082668880575-og9vm3sduk1g7dlj8g17in3r1cicnbt6.apps.googleusercontent.com` |
| `GOOGLE_ANDROID_CLIENT_ID` | `1082668880575-5hrg3n2acflsjtf8bo9ih7b2dsecb9j2.apps.googleusercontent.com` |

### Frontend (eas.json preview profile)
| Var | Value |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Cloud Run service URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android client ID |

---

## 11. Branding

**App name:** PillCare Reminder
**Bundle ID:** `com.pillcare.reminder`
**Package:** `com.pillcare.reminder`
**Design:** Dark `#161826` background, `#9184d9` purple accent, `#a7a1db` accent-light

**Assets in `frontend/assets/images/`:**
- `icon.png` — 1024×1024, white background (App Store / Play Store)
- `adaptive-icon.png` — 1024×1024, transparent (composited onto white via app.json)
- `logo-mark.png` — 1024×1024, transparent (in-app use)
- `splash-image.png` — splash screen
- `favicon.png` — 196×196

---

## 12. Play Store Submission Checklist

| Item | Status |
|---|---|
| Drug resolver uses OpenFDA primary (not LLM) | ✅ Done |
| Photo scanner has "verify with pharmacist" disclaimer | ⬜ Pending |
| Store description has medical device disclaimer | ⬜ Pending |
| Switch to Organization Account | ⬜ Pending |
| Health Apps Declaration form | ⬜ Pending |
| Data Safety form (discloses Groq usage) | ⬜ Pending |
| Privacy policy page (in-app + public URL) | ⬜ Pending |
| Credential rotation verified | ⬜ Pending |
| Vault security (biometric/PIN for prescriptions) | ⬜ Pending |
| Delete account + individual entry option | ⬜ Pending |
| Production AAB build | ⬜ Pending |

---

## © PillCare. All rights reserved.
