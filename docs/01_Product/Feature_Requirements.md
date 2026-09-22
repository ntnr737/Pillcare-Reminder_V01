# PillCare - Feature Requirements Matrix

## 1. Functional Requirements Matrix

| ID | Feature Name | Priority | Target User | Description | Acceptance Criteria |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **FR-01** | Medication Creation | **P0** | Patient | Create medication schedule with custom dosages, times, food relation, and stock limits. | Must save locally instantly and schedule exact Android/iOS local alarm. |
| **FR-02** | Alarm & Snooze | **P0** | Patient | Trigger full-screen high-priority alert at scheduled time with 5-min, 10-min, 15-min snooze options. | Must trigger sound/vibration even in Do Not Disturb / Low Power Mode. |
| **FR-03** | Caregiver Shield | **P0** | Caregiver | Dispatch WhatsApp alert to registered caregiver if medication is not marked taken within 15 minutes. | Alert logged in database and dispatched via WhatsApp API payload. |
| **FR-04** | OCR Scanner | **P1** | Patient | Scan physical prescription using camera to extract drug name, dosage, and frequency. | Text recognized with $>90\%$ accuracy and auto-populates creation form. |
| **FR-05** | Refill Radar | **P1** | Patient | Monitor remaining pill count and alert user when stock drops below user-defined threshold. | Stock decrements on dose confirmation; refill modal pops up automatically. |
| **FR-06** | AI Yoga Routine | **P2** | Patient | Provide curated video flows for blood pressure, glucose, and anxiety management. | Session logs completion date, duration, and updates patient wellness journal. |
| **FR-07** | Flash Banners | **P1** | Admin / User | Display real-time promo/announcement banners on the Today tab. | Pushed from Admin Panel; respects plan targeting (Free vs Pro). |
| **FR-08** | 2-Way Overrides | **P0** | Admin | Manually override user plan or specific feature flags (e.g. enable OCR scanner for Free user). | Precedence rule: Admin override > Plan default rule. |

---

## 2. Dependencies & Assumptions
- Native Android `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` permissions must be granted by OS.
- Caregiver alert dispatch requires active network connectivity on device or server-side cron trigger.
- Offline logs synchronize seamlessly once device reconnects to internet.
