# THREAT: Security & Abuse Model

> **Scope**: Threat modeling across mobile, backend APIs, and database trust boundaries.  
> **Key Rule**: Attackers live on every path other than the happy path. An admitted gap beats a hidden one.

---

## 1. Actors & Entry Points

| Actor | Access Level | Entry Points |
| :--- | :--- | :--- |
| **Anonymous Attacker** | Unauthenticated public network | `/health`, `/auth/login`, `/auth/register`, `/auth/google`, `/announcements/active`, `/analytics/crash` |
| **Malicious Authenticated User** | Valid user JWT token | `/api/me/sync-state`, `/api/doses/*`, `/api/medications/*`, `/activities`, `/payments/*`, `/users/heartbeat` |
| **Compromised Dependency** | Code running inside mobile runtime or Node/Python process | npm packages in `frontend/`, pip packages in `backend/` |
| **Rogue / Insincere Caregiver** | Caregiver linked to a patient account | `/profile/caregiver`, `/api/doses/*` |

---

## 2. Realistic Abuse Vectors & Mitigations

### Vector 1: Telemetry Flood / Crash Reporting DoS
- **Actor**: Anonymous attacker.
- **Action**: Bombarding `/api/analytics/crash` with megabytes of fake stack traces to exhaust MongoDB storage and spike Cloud Run billing.
- **Mitigation**:
  - SlowAPI rate limiting enforced on `/api/analytics/crash` (max 10 requests/minute per IP).
  - Pydantic payload truncation (stack traces capped at 2,000 characters).
  - Background Sentinel Agent monitors ingest volume anomalies.

### Vector 2: Dose Manipulation / Fake Adherence Spoofing
- **Actor**: Authenticated user trying to cheat leaderboards or fake medical adherence.
- **Action**: Sending bulk `/api/doses/{id}/status` requests with future timestamps.
- **Mitigation**:
  - Server validation rejects timestamps > 5 minutes in the future.
  - User can only update doses matching their authenticated `user_id`.

### Vector 3: Payment Verification Spoofing
- **Actor**: Malicious user attempting to unlock Premium tiers for free.
- **Action**: Calling `/payments/verify` with fabricated `payment_id` or dummy order ID.
- **Mitigation**:
  - Server computes cryptographic HMAC SHA-256 signature against Razorpay webhook secret.
  - Replay protection: payment IDs are marked as consumed in MongoDB; subsequent attempts with the same ID fail with 400 Bad Request.

### Vector 4: Notification Injection via Deep Links
- **Actor**: Third-party app triggering custom URL schemes.
- **Action**: Firing intent `pillcare://` to force navigation into admin routes or execute arbitrary JavaScript.
- **Mitigation**:
  - Strict navigation allowlist in `notifications.ts`: Only allowed routes (`/(tabs)/today`, `/(tabs)/treatment`, `/(tabs)/progress`, `/(tabs)/profile`, `/(tabs)/yoga`) can be navigated to via notifications.
  - Deep link query parameters are sanitized before router consumption.

---

## 3. Known Gaps & Future Hardening

- **Admitted Gap**: Offline client clocks. If a user manually changes their phone clock backwards, local streak calculations could be manipulated until the next server sync corrects the timestamp.
- **Remediation Plan**: Compare device clock against server HTTP header `Date` during `api.syncState` calls and flag discrepancies $> 15$ minutes.
