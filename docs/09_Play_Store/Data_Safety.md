# Google Play Console Data Safety Form Declarations

## 1. Declarations Summary

| Question | Answer | Notes |
| :--- | :---: | :--- |
| **Does your app collect or share user data?** | **YES** | Medication names & caregiver contact phone numbers for alert escalation. |
| **Is all user data encrypted in transit?** | **YES** | TLS 1.3 HTTPS protocol strictly enforced. |
| **Do you provide a way for users to request data deletion?** | **YES** | In-app 1-tap delete account & local storage wipe. |
| **Is data collection optional?** | **NO** | Core functionality (alarm scheduling) requires local storage of med names. |

---

## 2. Data Types Declared

1. **Health Info (Health & Fitness)**:
   - Data Type: Medications, dosage schedules, adherence percentage.
   - Purpose: App functionality, analytics.
   - Encryption: Encrypted in transit & at rest.

2. **Personal Info (Name, Email, Phone Number)**:
   - Data Type: User name & Caregiver phone number.
   - Purpose: Emergency alert dispatch via WhatsApp API.
   - Sharing: Shared ONLY with authorized caregiver number specified by patient.
