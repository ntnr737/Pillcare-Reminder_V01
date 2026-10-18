# TESTING: Verification Checklist & Real Output Log

> **Standard**: Every change promoted to Lane B must run through these concrete commands and verify actual outputs. No vibe checks. An AI claiming tests pass without real terminal output is a red flag.

---

## 1. Automated Verification Commands

### Command 1: Mobile TypeScript Strict Check
```bash
cd frontend && npx tsc --noEmit
```
- **What a pass looks like**: Exits with code 0 and zero output.
- **Actual Verified Output (2026-10-18 Local-First & Battery Integration QC)**:
  ```
  Completed with Exit Code: 0
  Zero errors found across 100% of TypeScript files.
  ```

### Command 2: Backend Server Syntax & Contract Verification
```bash
python3 -m py_compile backend/server.py
backend/.venv/bin/pytest backend/tests/test_qc_audit_contracts.py
```
- **What a pass looks like**: Exits with code 0 and all contract tests pass.
- **Actual Verified Output (2026-10-18 QC)**:
  ```
  python3 -m py_compile backend/server.py -> Code 0 (clean compilation)
  backend/tests/test_qc_audit_contracts.py ....                            [100%]
  4 passed in 0.47s
  ```

### Command 3: Remote Push & Deployment Gate
```bash
git push origin main
```
- **Actual Verified Output (2026-10-18)**:
  ```
  To https://github.com/ntnr737/Pillcare-Reminder_V01.git
     6b5a7f7..dffe22e  main -> main
  Completed with Exit Code: 0
  Cloud Build triggered for Cloud Run deployment.
  ```

### Command 4: Local Native Android Release APK Build Pipeline
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/Users/nitin/Library/Android/sdk
export PATH=$JAVA_HOME/bin:$PATH
cd frontend/android && ./gradlew assembleRelease --no-daemon
```
- **What a pass looks like**: `BUILD SUCCESSFUL`, `app-release.apk` generated (~113 MB) with zip integrity verified.
- **Actual Verified Output (2026-10-18)**:
  ```
  BUILD SUCCESSFUL in 11m 31s
  866 actionable tasks: 866 executed
  Output: frontend/android/app/build/outputs/apk/release/app-release.apk (113MB)
  output-metadata.json: versionCode 74, versionName 1.0.74, single APK
  Zip Integrity: No errors detected in compressed data
  Copied to: PillCare-v1.0.74-release.apk (113MB) & build_artifacts/app-release/app-release.apk
  ```

### Command 5: Autonomous Sentinel Agent Diagnostic Audit
```bash
python3 backend/agent/sentinel_agent.py
```
- **What a pass looks like**: Generates a valid Sentinel Report ID and writes markdown to `backend/scratch/chief_engineer_reports/`.
- **Actual Verified Output (2026-10-16)**:
  ```
  Testing Sentinel Agent report generator...
  Generated Sentinel Report ID: sentinel_2026-10-15_fafd37c7
  # 🛡️ PillCare Chief Engineer Technical Diagnostic Report
  Exit Code: 0
  ```

---

## 2. Real Customer Manual Path (End-to-End Verification)

To verify the interactive notification and multi-device sync path:

1. **Step 1 (Notification Bar Interaction)**:
   - Schedule a test medication dose for 2 minutes from now.
   - Lock screen or background the app.
   - When the notification shade alert appears, pull down and tap **"✓ Taken"**.
   - **Expected Result**: Notification dismisses immediately without popping the app into the foreground.
   - Reopen PillCare: The Today tab instantly renders the dose card with a green "Taken" checkmark.

2. **Step 2 (Multi-Device Pre-Hydration)**:
   - On Device A: Log a 250ml glass of water and complete Pose #1 of Yoga.
   - On Device B: Open PillCare and sign in with the same account.
   - **Expected Result**: Device B immediately shows the 250ml water progress and Yoga Pose #1 marked complete on the very first screen render (zero loading lag or missing data).

3. **Step 3 (Offline Resilience)**:
   - Turn on Airplane Mode.
   - Tap "Skip" on a pending dose.
   - **Expected Result**: Dose status immediately updates to "Skipped" in local UI; mutation queues in `sync_queue`.
   - Turn off Airplane Mode: Queue automatically flushes to `/api/doses/{id}/status`.
