# PillCare - System Requirements Specification (SRS)

## 1. Introduction
This System Requirements Specification (SRS) defines the software, hardware, operational, and non-functional requirements for the PillCare Medication Adherence & Healthcare Intelligence system, following IEEE 830 standards.

---

## 2. System Performance SLAs & Specifications

### 2.1 Latency SLA
- **Local Medication Alarm Trigger**: $0\text{ms}$ delay (Fired locally by native OS `AlarmManager` / `UserNotifications`).
- **API Response Latency**: $\le 100\text{ms}$ for 99th percentile of REST requests under normal network conditions.
- **Caregiver Alert Escalation**: Dispatch initiated within $\le 30\text{ seconds}$ of grace period expiration.

### 2.2 System Throughput & Scale
- **Backend Concurrency**: Cloud Run container scaling to handle $\ge 10,000$ requests/minute.
- **Database I/O**: Local SQLite transactions execute in $<5\text{ms}$.

---

## 3. Hardware & Platform Compatibility Matrix
- **Android**: Android 8.0 (API Level 26) up to Android 15/16 (API Level 36).
- **iOS**: iOS 15.0 and above.
- **Web Admin**: Chrome 100+, Safari 15+, Edge 100+ (Responsive $\ge 1024\text{px}$).
