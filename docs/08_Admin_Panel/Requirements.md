# PillCare Admin Panel - Mission Control Requirements

## 1. Overview & Capabilities
The PillCare Admin Panel (`admin.html` hosted live on `admin.pillcare.in`) provides real-time operational management, financial monitoring, healthcare intelligence analytics, and 2-way client controls.

---

## 2. Core Functional Requirements

### 2.1 Security & Auth Gateway
- Google Sign-In Single Sign-On (SSO) with DOM fallback.
- Mandatory `x-admin-secret` header verification (`pillcare_admin_secret_key_2026`).

### 2.2 JP Morgan Grade Financial Dashboard
- **MRR (Monthly Recurring Revenue)**: Calculated from active Pro subscriptions.
- **ARR (Annual Run Rate)**: $\text{MRR} \times 12$.
- **ARPU (Average Revenue Per User)**: $\text{Total Revenue} / \text{Active Users}$.
- **LTV (Lifetime Value)** & **Churn Rate**: Calculated across subscription cohorts.

### 2.3 Healthcare Intelligence & Refill Radar
- **Adherence Rate Tracker**: Percentage of scheduled doses confirmed taken vs missed.
- **Estimated Refill GMV (Gross Merchandise Value)**: Projected pharmacy prescription value.
- **Caregiver Alert Counters**: Total missed-dose alerts dispatched.
- **Condition Distribution Heatmap**: Patient distribution across Hypertension, Diabetes, Asthma, etc.

### 2.4 Swiggy / Zomato Flash Announcement Publisher
- Form to create title, body, plan targeting (`all`, `free`, `pro`), type (`offer`, `alert`), and link URL.
- 1-Click announcement revocation button.

### 2.5 2-Way Manual Feature Overrides
- Search user by ID or email.
- Override subscription tier (Free $\rightarrow$ Pro/Enterprise).
- Toggle specific feature flags (`scanner`, `caregiver_shield`, `export`, `max_medications`).
