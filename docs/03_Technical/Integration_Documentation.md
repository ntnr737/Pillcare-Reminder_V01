# PillCare - Integration & Third-Party Services Documentation

## 1. Integrations Summary

| Provider | Purpose | Protocol | Fallback / SLA |
| :--- | :--- | :--- | :--- |
| **WhatsApp Business API** | Caregiver Missed Dose & Refill Alerts | Webhook / REST POST | Fallback to SMS via Twilio / Gupshup |
| **Google Sign-In OAuth 2.0** | Single Sign-On (SSO) Patient Auth | OAuth2 OpenID Connect | Local Device PIN / Biometrics |
| **Android Health Connect / Apple HealthKit** | Health Metrics & Vitals Aggregation | Native Device Bridge API | Manual Self-Reported Log Entry |
| **Firebase Cloud Messaging (FCM)** | Remote Push Notifications & Banners | HTTP/v1 Protocol | Local Native OS Alarm Manager |
| **Cloudflare DNS & Transform Rules** | Subdomain Routing (`admin.pillcare.in`) | Edge Proxy URL Rewrite | Direct Backend Host IP Routing |

---

## 2. WhatsApp Caregiver Payload Example
```json
{
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "pillcare_missed_dose_alert",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Metformin HCl 500mg" },
          { "type": "text", "text": "08:00 AM" }
        ]
      }
    ]
  }
}
```
