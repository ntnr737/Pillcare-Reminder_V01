# PillCare - REST API Specification

## 1. Authentication Headers
All protected client endpoints require Bearer JWT token:
```http
Authorization: Bearer <session_token>
```
All protected admin endpoints require Admin Secret Key:
```http
x-admin-secret: pillcare_admin_secret_key_2026
```

---

## 2. Core API Endpoints Reference

### 2.1 User & Feature Management
- **`GET /api/me/features`**: Fetches user active plan and feature flags (respects 2-way admin overrides).
  - *Response 200*: `{"plan": "premium", "max_medications": 999, "scanner": true, "caregiver_shield": true}`

### 2.2 Medications & Refills
- **`POST /api/medications`**: Create medication record.
  - *Payload*: `{"name": "Metformin", "dosage": "500", "unit": "mg", "times": ["08:00"], "stock": 30}`
- **`POST /api/medications/{id}/refill`**: Refill pill inventory.
  - *Payload*: `{"add_stock": 30}`
  - *Response 200*: `{"ok": true, "stock": 60}`

### 2.3 Flash Announcements
- **`GET /api/announcements/active?plan=free`**: Fetches active Swiggy/Zomato style banners.
- **`POST /admin/announcements`** *(Admin Only)*: Publish flash banner.
- **`DELETE /admin/announcements/{id}`** *(Admin Only)*: Revoke live announcement.

### 2.4 Healthcare & Financial Analytics *(Admin Only)*
- **`GET /admin/analytics/financials`**: Returns MRR, ARR, ARPU, LTV, Churn, Tier Breakdown.
- **`GET /admin/analytics/healthcare-intelligence`**: Returns adherence rates, refill GMV, risk heatmaps, caregiver dispatch counts.
- **`POST /admin/users/{user_id}/features`**: 1-Click manual feature override.
