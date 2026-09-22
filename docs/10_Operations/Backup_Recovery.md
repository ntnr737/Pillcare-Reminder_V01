# PillCare Disaster Recovery & Backup Strategy

## 1. Recovery Objectives

- **Recovery Point Objective (RPO)**: $<15\text{ minutes}$ (Maximum acceptable data loss window)
- **Recovery Time Objective (RTO)**: $<1\text{ hour}$ (Maximum acceptable downtime window)

---

## 2. Backup Schedules & Retentions

| Resource | Backup Method | Frequency | Retention Period | Storage Location |
|---|---|---|---|---|
| **Cloud SQL (PostgreSQL)** | Automated GCP Snapshots | Daily at 02:00 UTC | 30 Days | GCP Multi-Region (`eu`) |
| **Cloud SQL Write Logs** | Point-In-Time Recovery (PITR) WAL | Continuous | 7 Days | GCP Storage Bucket (`gs://pillcare-pitr-wal`) |
| **Firestore NoSQL State** | Export Command via Cloud Scheduler | Every 6 hours | 14 Days | GCS Nearline Storage |
| **App Configuration & Secrets** | Terraform State + Secret Manager | Version Controlled / Commit Tag | Infinite | Private GitHub + GCP KMS |
| **User Media & Attachments** | GCS Bucket Replication | Real-time Object Versioning | 90 Days | GCS Dual-Region (`europe-west1` + `europe-west4`) |

---

## 3. Disaster Recovery Procedures

### Scenario A: Database Corruption or Loss (Point-in-Time Restore)
1. Identify exact time of corruption ($T_{corrupt}$).
2. Execute Cloud SQL PITR command:
   ```bash
   gcloud sql instances restore-instance pillcare-postgres-db \
     --restore-instance=pillcare-postgres-db-pitr-target \
     --backup-instance=pillcare-postgres-db \
     --point-in-time="2026-09-15T23:45:00Z"
   ```
3. Verify table integrity using database validation scripts.
4. Update Cloud Run DB connection string environment variable to target restored instance.
5. Re-enable traffic via Cloud Run revisions.

### Scenario B: Regional GCP Outage
1. Initiate failover to secondary GCP region (`europe-west4`):
   ```bash
   gcloud run deploy pillcare-backend \
     --region=europe-west4 \
     --image=europe-west1-docker.pkg.dev/pillcare-prod/app/backend:latest
   ```
2. Update Cloud DNS A/AAAA records to point `api.pillcare.in` to secondary region load balancer IP.
3. Validate client app latency and notification delivery status.

---

## 4. Disaster Recovery Testing Schedule

- **Tabletop Exercises**: Conducted quarterly with engineering leads.
- **Failover Drills**: Conducted semi-annually in staging environment.
- **Backup Restoration Validation**: Automated monthly test restore pipeline to isolated sandbox DB.
