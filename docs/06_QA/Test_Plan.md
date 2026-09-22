# PillCare - QA Master Test Plan

## 1. Test Strategy Overview
The QA strategy for PillCare combines automated end-to-end integration tests, security fuzz testing (SQLi/XSS), TypeScript strict static analysis, and manual senior-focused UAT.

---

## 2. Testing Levels & Tools

| Level | Tool / Framework | Target Scope | Execution Frequency |
| :--- | :--- | :--- | :--- |
| **Static Analysis** | TypeScript (`npx tsc --noEmit`) | Type safety & API contracts | Pre-commit / CI |
| **Backend Integration** | Python `httpx` / `pytest` | Async API endpoints & Database ORM | Daily / Automated |
| **Fuzz & Vulnerability** | Python Fuzzing Scripts | SQLi & XSS injection resilience | Pre-release |
| **End-to-End Monkey** | Custom Monkey Test Runner | 17-Point complete system validation | Pre-release |
| **Mobile Native UI** | Expo Go / Android Emulator | Alarm triggers & UI touch targets | Release Candidate |
