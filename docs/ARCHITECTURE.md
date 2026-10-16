# ARCHITECTURE: PillCare High-Level System Map

> **Scope**: 1-Page Architectural Overview  
> **Deeper References**: Root [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`docs/FLOW.md`](FLOW.md), [`docs/DATA.md`](DATA.md)

---

## 1. Modules & Ownership

```mermaid
graph TB
    subgraph Client_Boundary ["Client Device Boundary (Untrusted UI / Local Storage)"]
        MOBILE["PillCare Mobile App (React Native Expo 57)"]
        LOCAL_DB[("AsyncStorage / SecureStore\nLocal-First Offline Cache")]
        NOTIF_MGR["expo-notifications & expo-task-manager\n(Foreground & Headless Background Runner)"]
        ADMIN_WEB["Admin Web Panel (Next.js / React)"]
    end

    subgraph Trust_Boundary ["Trust Boundary (Cloud Run Gateway & Rate Limiting)"]
        FASTAPI["FastAPI Backend (Python 3.11 / Uvicorn)\n- Auth & JWT Middleware\n- Sync & Doses Engine\n- Telemetry & Sentinel Router"]
    end

    subgraph Cloud_Data ["Cloud Data Storage & Services"]
        MONGO[("MongoDB Atlas\nPrimary Document Store")]
        FIREBASE["Firebase Cloud Messaging (FCM)\nRemote Push Delivery"]
        SENTINEL["Autonomous Sentinel Agent\n(Audit Runner & Crash Triage)"]
    end

    MOBILE <--> LOCAL_DB
    NOTIF_MGR --> LOCAL_DB
    MOBILE -->|HTTPS + Bearer JWT| FASTAPI
    NOTIF_MGR -.->|Async Sync & Telemetry| FASTAPI
    ADMIN_WEB -->|HTTPS + x-admin-secret| FASTAPI
    FASTAPI <--> MONGO
    FASTAPI -.->|Push Notifications| FIREBASE
    SENTINEL <--> MONGO
    FASTAPI -->|On-Demand Audit Trigger| SENTINEL
```

### Module Responsibilities:
1. **PillCare Mobile Frontend (`frontend/src/`)**:
   - Manages UI tabs (`Today`, `Treatment`, `Progress`, `Yoga`, `Support`).
   - Owns local-first offline storage (`sync.ts`) and deterministic dose status resolution.
   - Executes local notification scheduling and headless action interception (`notifications.ts`).
2. **FastAPI Cloud Run Backend (`backend/server.py`)**:
   - Authorizes requests via JWT (`/auth/*`) and admin headers (`x-admin-secret`).
   - Serves consolidated atomic sync payloads (`/api/me/sync-state`) to minimize cloud latency and costs.
   - Enforces business logic: dose updates, streak calculations, payments, and push delivery.
3. **Autonomous Sentinel Agent (`backend/agent/sentinel_agent.py`)**:
   - Runs periodic or on-demand telemetry triage against `db.crash_reports`, `db.analytics_events`, and Cloud Run performance logs.
   - Generates executive engineering diagnostic reports for the Chief of Engineering.
4. **Admin Panel (`admin-panel/`)**:
   - Operations portal for monitoring user cohorts, telemetry audits, revenue, and flash announcements.

---

## 2. Trust Boundaries & Data Flow

- **External Input**: All payloads crossing into FastAPI from mobile or web must pass Pydantic schema validation.
- **Client Cache Independence**: The mobile client is designed to operate completely offline. Network sync is asynchronous and idempotent.
- **Security Perimeter**: Production secrets and MongoDB credentials reside strictly in Google Cloud Secret Manager / `.env` on Cloud Run.
