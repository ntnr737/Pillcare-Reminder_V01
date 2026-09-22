# PillCare - Pre-Release Checklist

## 1. Quality & Security Checks
- [x] **TypeScript Validation**: `npx tsc --noEmit` returns 0 errors.
- [x] **Monkey End-to-End Test**: `python backend/scratch/full_monkey_end_to_end_test.py` passes 17/17 tests.
- [x] **SQLi & XSS Fuzz Audit**: Parameterized ORM sanitization verified.
- [x] **Admin Authorization Lock**: `/admin/*` routes verify `x-admin-secret` header.

---

## 2. Environment & Build Checks
- [x] `EXPO_PUBLIC_BACKEND_URL` pointing to production GCP Cloud Run endpoint.
- [x] `app.json` versionCode incremented (`versionCode = 1`).
- [x] Android Release APK compiled (`app-release.apk` 112 MB verified).
- [x] **User Consent Verification**: User explicit permission requested before git push.
