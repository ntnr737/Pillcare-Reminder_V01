# PillCare - Product Requirements Document (PRD)

## 1. Executive Summary
**PillCare** is a healthcare technology platform engineered to maximize patient medication adherence, reduce accidental missed doses, and empower caregivers through automated emergency escalation. Powered by a hybrid offline-first architecture, PillCare ensures uninterrupted local alarm notifications even without internet connectivity while providing real-time telemetry to caregivers and medical providers.

---

## 2. Target Personas
1. **Senior Patients (Chronic Illness)**: Requires high-contrast UI, large touch targets ($\ge 48\text{dp}$), voice alarms, and automatic dose logging.
2. **Busy Professionals**: Requires rapid optical prescription scanning (OCR), 1-tap confirmation, calendar integration, and refill automation.
3. **Caregivers & Guardians**: Requires real-time SMS/WhatsApp missed dose alerts, refill status visibility, and multi-patient management.
4. **Enterprise Healthcare Providers**: Requires adherence risk heatmaps, revenue analytics, and custom feature control via Mission Control.

---

## 3. Core Product Capabilities & Feature Specifications

### 3.1 Medication Scheduling & Smart Alarms
- Flexible schedules: Daily, specific days, alternate days, interval cycles, and AS NEEDED (PRN).
- Exact alarm scheduling using native Android `AlarmManager` / iOS `UserNotifications` bypassing OS battery optimization (`USE_EXACT_ALARM`).
- Food relationship tagging: `before_food`, `with_food`, `after_food`, `empty_stomach`.

### 3.2 Caregiver Shield (Emergency Escalation)
- Multi-tier escalation: Primary caregiver, secondary guardian, emergency contact.
- Automated WhatsApp & SMS alert dispatch upon missed medication window ($\ge 15\text{ mins}$).
- Caregiver Web Portal link dispatched via secure single-use token.

### 3.3 Swiggy / Zomato Flash Announcement Engine
- Dynamic top banner announcements pushed in real-time from Admin Control Center.
- Audience targeting: Free plan users, Pro subscribers, or Enterprise hospital groups.
- Live conversion tracking (CTR & impression logging).

### 3.4 Refill Radar & Automated Inventory
- Real-time pill inventory decrement upon dose confirmation.
- Refill threshold alerts (e.g., alert when stock drops below 5 pills).
- 1-Tap pharmacy reordering via partner API / WhatsApp message templates.

### 3.5 AI Yoga & Wellness Therapy
- Custom pranayama and gentle yoga video routines tailored to specific medical conditions (Hypertension, Diabetes, Joint Stiffness).
- Daily compliance journal logging and streak tracking.

---

## 4. Monetization & Subscription Tiers

| Feature | Free Tier | Pro Moksha (₹99/mo) | Enterprise Hospital |
| :--- | :---: | :---: | :---: |
| Active Medications | Up to 3 | Unlimited (999) | Unlimited |
| Caregiver Alerts | 1 Contact | Unlimited Caregivers | Dedicated Escort |
| OCR Scanner | 2 Scans/mo | Unlimited Scans | EHR Auto-Sync |
| Yoga Therapy | Basics | Full HD Library | Custom Routines |
| Feature Overrides | Default | Admin Modifiable | Custom Hospital SLA |

---

## 5. Non-Functional Requirements & Constraints
- **Offline-First**: All alarms, schedules, and dose logs operate 100% offline via SQLite (`AsyncStorage`).
- **Telemetry Latency**: Event dispatch latency $<100\text{ms}$ when connected.
- **Privacy & Compliance**: Zero sale of personal health information; HIPAA & DISHA compliant data boundaries.
