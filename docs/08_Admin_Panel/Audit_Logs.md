# PillCare Admin Panel - Audit Logs & Compliance Security

## 1. Audit Log Capture Schema
All administrative actions (plan upgrades, feature overrides, announcement publishing, revenue queries) are automatically recorded in the audit log database table:

```json
{
  "id": "audit_91823102",
  "timestamp_iso": "2026-09-15T00:45:00Z",
  "admin_user": "nitinrai264@gmail.com",
  "action": "USER_PLAN_UPGRADE",
  "target_user_id": "test_user_676cf52c",
  "details": {
    "previous_plan": "free",
    "new_plan": "premium",
    "override_note": "Hospital Enterprise Contract"
  },
  "ip_address": "103.21.124.5"
}
```

---

## 2. Security Alerts
- **Repeated Auth Failure Alert**: Triggered if 5+ invalid `x-admin-secret` headers are received within 60 seconds.
