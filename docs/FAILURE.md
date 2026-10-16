# FAILURE: Resilience, Degradation & Dependency Failure Map

> **Scope**: Dependency failure modes, system limits, and blast radius analysis.  
> **Key Insight**: "Where does this fail?" is the question that separates people who truly understand a system from people who merely deployed it.

---

## 1. Dependency-by-Dependency Failure Map

| Dependency | If Slow (> 3s) | If Down (5xx / Unreachable) | If Wrong / Corrupt Data | If Empty Response |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Run Backend** | Client uses cached data instantly; displays subtle "Offline Mode" badge. | Requests queue in `sync.ts` offline storage; app remains 100% operational locally. | Pydantic schema rejection prevents corrupt state from polluting local storage. | SWR defaults to empty state without throwing unhandled exceptions. |
| **MongoDB Atlas** | Slow query log triggered; FastAPI returns 504 Gateway Timeout after 5s limit. | FastAPI enters `degraded` health status (`/health`); logs alert to Sentinel Agent. | Aggregation pipeline drops invalid documents; does not crash worker processes. | Endpoints return empty list `[]` with HTTP 200 rather than throwing null pointers. |
| **Local AsyncStorage** | UI renders default skeletons until storage resolves. | Falls back to in-memory React state; session data lost on app force quit. | `JSON.parse` wrapped in try/catch; corrupt key deleted and refetched from server. | Initializes fresh empty storage arrays. |
| **Expo Notifications Subsystem** | Notification triggers with slight OS jitter (< 1 min). | Fallback to in-app banner reminders when user opens app. | Fallback to default channel ID and standard notification sound. | Cancels scheduling without crashing background task runner. |
| **Firebase Cloud Messaging (FCM)** | Scheduled local device alarms still fire on exact minute. | Remote caregiver nudge alerts delayed; local alarms remain 100% unaffected. | Malformed payload ignored by mobile listener. | Discarded by client. |

---

## 2. Hard System Limits & Scalability Thresholds

- **Client Storage Limit**: AsyncStorage key payload capped at 6MB. Current user profile + 30 days doses is ~250KB (< 5% of limit).
- **Backend Payload Limit**: Pydantic request body limit set to 5MB.
- **Concurrent Connections**: Cloud Run container concurrency limit set to 80 requests per instance before horizontal autoscaling spawns a new container.
- **Database Connection Pool**: Motor/PyMongo pool max size = 50 connections per Cloud Run instance.

---

## 3. How Failures Are Detected

1. **Client Crashes**: Forwarded to `/api/analytics/crash` and stored in `db.crash_reports`.
2. **Notification Drops**: Sentinel Agent calculates the ratio of scheduled reminders vs confirmed actions (`MARK_TAKEN` / `SKIP_DOSE`).
3. **Backend Outages**: Cloud Run uptime checks ping `/health` every 60 seconds; alerts triggered if success rate drops below 99.5%.
4. **Billing Anomalies**: Google Cloud budget alert fires if Cloud Run invocations or CPU hours exceed monthly baseline by >25%.
