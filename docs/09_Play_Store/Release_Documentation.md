# Google Play Store Release Documentation

## 1. Versioning Specification
- **`version`**: `1.0.0`
- **`versionCode`**: `1` (Increments +1 per Play Console release).
- **Target SDK**: Android 16 (API 36).
- **Min SDK**: Android 8.0 (API 26).

---

## 2. Release Artifact Generation Command
To build the signed Android App Bundle (`.aab`) for Google Play Store upload:
```bash
cd frontend/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=~/Library/Android/sdk \
./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a
```
Output bundle generated at `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
