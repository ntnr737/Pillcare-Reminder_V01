# PillCare - System Architecture Specification

## 1. High-Level Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
| CLIENT LAYER                                                                      |
|  - Mobile App: React Native (Expo SDK 57, Hermes JS Engine)                        |
|  - Admin Portal: HTML5 / Modern CSS / Vanilla JS (admin.pillcare.in)              |
+-----------------------------------------------------------------------------------+
                                         |
                                    HTTPS / REST
                                         v
+-----------------------------------------------------------------------------------+
| NETWORK & EDGE ROUTING                                                            |
|  - Cloudflare CNAME DNS & Transform URL Rewrites (admin.pillcare.in -> /admin.html)|
|  - GCP Cloud Run Container Endpoint                                              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| BACKEND SERVICES LAYER (FastAPI Async Python Core)                                |
|  - Authentication & JWT Validator Module                                          |
|  - Medication & Refill Radar Engine                                              |
|  - Swiggy/Zomato Flash Announcements Publisher                                   |
|  - Healthcare Intelligence & JP Morgan Financial Analytics                        |
|  - Caregiver Shield WhatsApp Dispatch Service                                     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| DATA PERSISTENCE LAYER                                                            |
|  - Mobile Client: Local SQLite DB (Offline-First Storage)                         |
|  - Backend Server: SQLite / Cloud SQL (PostgreSQL Engine)                         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Key Subsystem Components
1. **Local Notification Engine (`expo-notifications`)**: Manages native alarms bypasses battery optimization (`SCHEDULE_EXACT_ALARM`).
2. **FastAPI Backend (`backend/server.py`)**: Asynchronous Python ASGI microservice hosting REST endpoints, analytics calculators, and admin security gatekeeper.
3. **Caregiver Alert Escalation Service**: Listens for unconfirmed dose timestamps and dispatches WhatsApp template alerts to registered caregiver numbers.
