# PillCare - CI/CD Pipeline Documentation

## 1. Pipeline Overview (`.github/workflows/build-android.yml`)

```text
  Push to main Branch
         |
         v
+-------------------------------------------------------------+
| GitHub Actions Runner (ubuntu-latest)                        |
|  1. Checkout code & Setup JDK 17 / Node.js 22               |
|  2. npm ci (Install dependencies)                           |
|  3. npx expo prebuild --platform android --clean             |
|  4. ./gradlew assembleRelease -PreactNativeArchitectures=... |
|  5. Upload app-release.apk to GitHub Action Artifacts       |
+-------------------------------------------------------------+
```

---

## 2. Expo EAS Cloud Pipeline
Triggered via `EXPO_TOKEN` authenticated CLI:
```bash
EXPO_TOKEN=<token> npx eas build --platform android --profile preview --non-interactive
```
Generates cloud build link and downloadable standalone APK.
