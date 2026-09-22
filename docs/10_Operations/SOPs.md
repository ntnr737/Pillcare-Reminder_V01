# PillCare Operations - Standard Operating Procedures (SOPs)

## 1. SOP-001: Daily Backend Health Check
1. Execute health check HTTP GET against GCP Cloud Run container:
   ```bash
   curl -i https://pillcare-backend-1082668880575.europe-west1.run.app/health
   ```
2. Verify HTTP status is `200 OK`.
3. Check Cloud Run latency graphs on GCP Console ($<100\text{ms}$ median).

---

## 2. SOP-002: Provisioning Hospital Enterprise Subscriptions
1. Log into `admin.pillcare.in`.
2. Locate hospital patient list or input user ID.
3. Apply plan upgrade: `enterprise` with 365-day validity.
4. Verify 2-way override is stored in database.
