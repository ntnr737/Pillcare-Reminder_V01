# PillCare Admin Panel - Role-Based Access Control (RBAC)

## 1. RBAC Matrix

| Role | Financial KPIs | Healthcare Intel | Flash Announcements | Feature Overrides | System Audit Logs |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin** | Full Access | Full Access | Publish / Delete | Full Overrides | View & Export |
| **Support Specialist** | Read Only | Patient Summary | View Only | Modify User Plan | No Access |
| **Marketing Manager** | Revenue CTR | Conversion Data | Publish / Delete | No Access | View Banners |
| **Medical Auditor** | No Access | Anonymized Intel | No Access | No Access | View Compliance |

---

## 2. API Scope Matrix
- `x-admin-role: superadmin` required for manual feature overrides (`POST /admin/users/{id}/features`).
- `x-admin-role: marketing` required for announcement publishing (`POST /admin/announcements`).
