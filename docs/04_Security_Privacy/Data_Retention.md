# PillCare - Data Retention & Purge Specification

## 1. Data Lifecycle Schedule

| Data Category | Local Retention | Cloud Retention | Automated Action |
| :--- | :--- | :--- | :--- |
| **Active Medication Schedules** | Indefinite (until deleted by user) | Active while account exists | Synchronized upon changes |
| **Dose Confirmation Logs** | 365 Days | 730 Days (Aggregated) | Pruned after 2 years |
| **Caregiver Alert Dispatch Logs** | 90 Days | 180 Days | Soft deleted after 90 days |
| **Swiggy/Zomato Announcement CTR** | N/A | 30 Days | Aggregated into conversion metrics |
| **Deleted Accounts** | Immediate local wipe | 30 Days (Purge window) | Permanent hard delete |

---

## 2. Hard Delete Purge Protocol
Upon user account deletion request:
1. Local SQLite tables (`medications`, `medication_logs`, `caregivers`) dropped/cleared locally.
2. Cloud database user record marked `is_deleted = TRUE` and queued for background purge task after 30 days.
