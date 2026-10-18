# ALTERNATIVES: Rejected Options & Trade-Offs Catalog

> **Scope**: Raw material for defending decisions at the whiteboard.  
> **Key Rule**: Without documenting what we rejected, every decision sounds like the only possible choice, which is a red flag.

---

## 1. Notification Architecture

### Rejected Alternative 1A: Force Open App on Every Notification Action
- **What it was**: Setting `opensAppToForeground: true` on all interactive notification action buttons.
- **Why rejected**: Terrible user experience. A patient taking medication or drinking a glass of water while on a phone call or driving should not have their active app abruptly replaced by PillCare.
- **Cost / Risk**: High user friction, increased app uninstalls.
- **Revisit if**: OS policies entirely ban background headless tasks on future Android/iOS versions.

### Rejected Alternative 1B: Pure Remote Push Architecture (FCM for All Reminders)
- **What it was**: Scheduling all medication and water reminders on a cloud cron server and pushing them via Firebase Cloud Messaging (FCM).
- **Why rejected**: Fails completely when the user is on an airplane, in an underground train, or has poor cellular connectivity. Cloud delivery delays of even 10–15 minutes can lead to missed doses.
- **Cost / Risk**: Massive Cloud Run egress and execution costs for millions of daily timer checks; dependency on network uptime.
### Rejected Alternative 1C: Strict Single Dynamic Channel ID
- **What it was**: Enforcing only dynamic channel IDs like `pc_medication_chime_v1` and banning static legacy channels.
- **Why rejected**: Dropped notifications on Android devices when notifications were scheduled with legacy/alias names (`medication-reminders`) or when sound settings were toggled during runtime.
- **Cost / Risk**: Silent notification delivery failure across various Android OEM versions.
- **Revisit if**: Android removes channel ID requirements in future OS versions.

---

## 2. Multi-Device Sync Architecture

### Rejected Alternative 2A: Full-Database Replication (WatermelonDB / PouchDB)
- **What it was**: Replacing AsyncStorage with an embedded SQLite sync database using CRDTs.
- **Why rejected**: Excessive complexity for current requirements. Required rewriting the entire backend schema and adding vector clocks and synchronization tables.
- **Cost / Risk**: High engineering risk, 4+ weeks of migration, and potential SQLite binary build issues on Expo Go.
- **Revisit if**: Multiple family members simultaneously edit the exact same medication record from different phones at the exact same second.

### Rejected Alternative 2B: Granular Entity REST Polling
- **What it was**: Client fires separate endpoints (`/api/medications`, `/api/doses`, `/api/activities`, `/api/yoga`, `/api/profile`) on every refresh.
- **Why rejected**: Tripled Cloud Run concurrency and database CPU utilization; caused UI flashing and staggered loading bars.
- **Cost / Risk**: High server bills ($$$) on Cloud Run; poor battery life on client devices.
- **Revisit if**: Individual entity sizes grow into multiple megabytes where fetching everything together causes payload bloat.

### Rejected Alternative 2C: Instant Cache Purge on Sign Out Without Queue Drain
- **What it was**: Wiping all local storage and session tokens synchronously the instant the user taps "Sign Out".
- **Why rejected**: Destroys pending offline logs (doses taken, water drunk) before they can be transmitted to Cloud Run. When the patient logs into another device, all recent activity appears lost.
- **Cost / Risk**: Apparent data loss across devices, patient anxiety over unrecorded clinical adherence.
- **Revisit if**: A device is reported stolen and immediate cryptographic zeroization is required.

---

## 3. Telemetry & Bug Tracking

### Rejected Alternative 3A: Commercial Third-Party APM (Datadog / New Relic)
- **What it was**: Installing full commercial APM agents across backend and mobile.
- **Why rejected**: High per-host and per-event subscription pricing ($15–$25/host/mo + event ingest fees); does not provide clinical adherence triage logic out of the box.
- **Cost / Risk**: Fixed high recurring monthly expenditure.
- **Revisit if**: Team scales past 20 engineers needing complex distributed tracing across multiple microservices.
