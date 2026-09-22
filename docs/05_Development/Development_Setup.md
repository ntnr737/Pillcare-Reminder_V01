# PillCare - Developer Environment Setup Guide

## 1. System Requirements & Prerequisites
- **Operating System**: macOS 14+ (ARM64 Apple Silicon or x86_64) or Linux (Ubuntu 22.04+).
- **Node.js**: v22.x LTS (with npm 10+ or Yarn 1.22+).
- **Python**: v3.14 (or v3.11+).
- **Java JDK**: OpenJDK 17 (`/opt/homebrew/opt/openjdk@17`).
- **Android SDK**: API Level 36, Build-Tools 35.0.0 / 36.0.0, NDK 27.1 (`r27b`).

---

## 2. Setting Up the Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```
Backend will start on `http://localhost:8000`.

---

## 3. Setting Up the Frontend
```bash
cd frontend
npm install
npx expo start
```

---

## 4. Local Android Build Execution
To compile a local debug/release APK directly:
```bash
cd frontend/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=~/Library/Android/sdk \
./gradlew assembleDebug
```
Output APK generated at `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
