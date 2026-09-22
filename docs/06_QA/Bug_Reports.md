# PillCare - QA Bug Reports & Historical RCA Log

## 1. Historical Resolution Log

### BUG-001: GitHub Actions CI `chmod` Directory Path Failure
- **Severity**: Critical (CI/CD Pipeline Failure)
- **Root Cause**: `working-directory: frontend` evaluated `chmod +x android/gradlew` relative to `frontend`, causing `chmod: cannot access 'android/gradlew': No such file or directory`.
- **Resolution**: Updated script to `cd frontend/android && chmod +x gradlew && ./gradlew assembleRelease`.

### BUG-002: GitHub Actions C++ Compilation Memory Exhaustion
- **Severity**: High (CI Runner Hang >40 mins)
- **Root Cause**: Compiling C++ TurboModules for 4 ABIs in parallel exhausted memory on 7GB `ubuntu-latest` runners.
- **Resolution**: Added `-PreactNativeArchitectures=arm64-v8a` and `--max-workers=2` to constrain memory usage.

### BUG-003: EAS CLI Project Permission Error
- **Severity**: Medium (Cloud Build Submission Error)
- **Root Cause**: Account handle mismatch between CLI session (`pillcare`) and browser org (`pillcare-reminder`).
- **Resolution**: Updated `app.json` owner to `pillcare-reminder` and authenticated via `EXPO_TOKEN`.
