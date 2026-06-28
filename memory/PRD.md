# PillCare Reminder — PRD

## Overview
A calm, dark-themed Expo + FastAPI mobile app for medication adherence and
personal health tracking. Single local profile (no auth wall) — auth scaffolding
(Firebase init + Analytics) is wired but not enforced.

## Stack
- Frontend: Expo SDK 54, React Native 0.81, expo-router 6, react-native-svg,
  @react-native-community/datetimepicker, expo-image-picker, expo-haptics,
  expo-notifications, firebase (JS SDK init).
- Backend: FastAPI + Motor (MongoDB), Pydantic v2.
- AI: Claude Sonnet 4.5 via Emergent LLM key (emergentintegrations) — used for
  Brand→Generic name resolution and AI medication scanner (vision).

## Screens
1. Onboarding (3 steps): Nickname → Gender + YOB → Daily routine times.
2. Today: greeting, week strip (sticky), dose cards with Taken/Skip actions,
   refill low-stock tag, FAB to add medication.
3. Treatment (sub-tabs): Medications, Measurements, Activities, Mood.
   - Full measurement catalog (BP, glucose, HR, weight, SpO2, temp, lipids,
     HbA1c, creatinine, TSH, vitamin D, hemoglobin, urea).
   - Activity catalog (steps, exercise, water, sleep).
4. Progress: 7-day adherence bar chart, streak + average, BP/glucose line
   trends, Health Connect / Apple Health CTA card.
5. Support: AI Scanner, Brand→Generic resolver, Caregiver setup, Lifetime
   history (CSV export), Privacy & Encryption, FAQ.

## Backend endpoints
- /api/profile (GET, POST upsert)
- /api/medications (GET, POST), /api/medications/{id} (GET, PATCH, DELETE)
- /api/doses?date_str=YYYY-MM-DD (GET, auto-generates per active med),
  /api/doses/{id}/status (POST taken/skipped)
- /api/measurements (GET, POST, DELETE)
- /api/activities (GET, POST, DELETE)
- /api/mood (GET, POST)
- /api/catalog/units, /api/catalog/measurements, /api/catalog/activities
- /api/progress/adherence?days=7
- /api/resolve-generic (Claude text)
- /api/scan-medication (Claude vision)
- /api/caregiver/alert (mocked OpenWA), /api/caregiver/log
- /api/export/csv

## Pragmatic deferrals
- Google Sign-In: Firebase initialized + Analytics live (web). OAuth client IDs
  not provided so login flow uses single local profile; auth can be flipped on
  later without breaking data models.
- Notifications & Health Connect: implemented as scaffolding; both require a
  native dev build (Expo Publish) to actually fire on devices.
- OpenWA caregiver alerts: MOCKED. Toggle live via OPENWA_ENABLED in backend .env.
- AES-256: actual encryption at rest is provided by the cloud DB + iOS Keychain /
  Android EncryptedSharedPreferences for credentials. Honest copy on Privacy screen.
