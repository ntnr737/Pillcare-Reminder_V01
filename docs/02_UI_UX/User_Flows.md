# PillCare - User Flows & Patient Journeys

## 1. Primary Patient Journey (Dose Logging & Caregiver Shield)

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant App as Mobile App (Expo)
    participant LocalDB as SQLite (Local)
    participant Notification as OS Alarm Manager
    participant Backend as FastAPI Backend
    participant Caregiver as Caregiver (WhatsApp)

    Patient->>App: Opens App & Schedules Medication
    App->>LocalDB: Saves Medication & Initial Stock (e.g. 30 pills)
    App->>Notification: Schedules Exact Local Alarm (e.g. 08:00 AM)
    
    Note over App,Notification: Time elapses to 08:00 AM
    Notification->>Patient: Fires Full-Screen Audio Alarm & High-Priority Banner

    alt Patient Takes Medication Promptly
        Patient->>App: Taps "MARK AS TAKEN"
        App->>LocalDB: Log Taken State & Decrement Stock (29 pills remaining)
        App->>Notification: Cancel Missed Dose Grace Timer
        App->>Backend: Sync Log Telemetry (Adherence +1)
    else Patient Misses Medication (15-Minute Window Expires)
        Note over App,Backend: Grace Period Expires (15 mins)
        App->>Backend: Dispatch Missed Dose Event
        Backend->>Caregiver: Send WhatsApp Alert ("Patient missed Metformin at 08:00 AM")
        Caregiver->>Patient: Calls / Reminds Patient directly
    end
```

---

## 2. Refill Automation Flow

```mermaid
flowchart TD
    A[Patient Takes Medication] --> B[Local Stock Decremented]
    B --> C{Remaining Stock <= Refill Threshold?}
    C -- No --> D[Normal State Retained]
    C -- Yes --> E[Trigger Refill Alert Modal]
    E --> F{Patient Choice}
    F -- 1-Tap Refill --> G[Update Stock + Add Pack Count]
    F -- Order Pharmacy --> H[Launch Pharmacy WhatsApp / Partner Link]
    G --> I[Refill Radar Updated in Database]
```

---

## 3. Admin Overrides & Flash Announcement Flow

```mermaid
sequenceDiagram
    actor Admin
    participant Dashboard as admin.pillcare.in
    participant Backend as FastAPI Backend
    participant App as Mobile App

    Admin->>Dashboard: Publish Swiggy/Zomato Flash Offer (50% Off Moksha Pro)
    Dashboard->>Backend: POST /admin/announcements
    Backend-->>Dashboard: 200 OK (Announcement ID: ann_123)

    App->>Backend: GET /api/announcements/active?plan=free
    Backend-->>App: Return Active Flash Offer Payload
    App->>App: Render Dynamic Flash Banner at top of Today Screen
```
