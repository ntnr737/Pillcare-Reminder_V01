# PillCare System Maintenance & Patch Management

## 1. Maintenance Windows

- **Routine Operations**: Scheduled every Tuesday between 02:00 UTC and 04:00 UTC.
- **Zero-Downtime Policy**: All backend API updates must be deployed using Cloud Run traffic splitting / blue-green deployments. Database schema changes must follow non-breaking multi-phase migrations.
- **Maintenance Notification Window**: 72 hours advance notice required for any disruptive maintenance via in-app banner and push notification.

---

## 2. Maintenance Tasks Checklist

### Weekly Tasks
- [ ] Review GCP Cloud Monitoring error rate graphs ($<0.01\%$ threshold).
- [ ] Inspect automated dependency vulnerability scans (Dependabot / Snyk).
- [ ] Clean up transient storage artifacts in GCS scratch buckets.

### Monthly Tasks
- [ ] Apply OS and security patches to backend base Docker images (`node:20-alpine` updates).
- [ ] Review IAM permission grants in GCP & Firebase Console; revoke stale access.
- [ ] Conduct automated database index fragmentation check and re-index if needed.
- [ ] Verify SSL/TLS certificate auto-renewals on Cloud Load Balancer.

### Quarterly Tasks
- [ ] Execute full Disaster Recovery restoration drill.
- [ ] Review API rate limiting thresholds and DDOS protection rules on Cloud Armor.
- [ ] Perform quarterly audit log review with compliance officer.

---

## 3. Planned Maintenance Procedure

1. **Pre-Maintenance**:
   - Create staging snapshot of database.
   - Publish in-app announcement banner via Admin Panel.
2. **Execution**:
   - Execute database migration scripts (`npx prisma migrate deploy` or equivalent).
   - Deploy updated Cloud Run backend service container.
   - Route $10\%$ traffic to new revision; monitor logs for 15 minutes.
   - Increase traffic to $100\%$ if error rates remain $<0.05\%$.
3. **Post-Maintenance**:
   - Verify health check endpoints (`GET /health`).
   - Remove maintenance banner.
   - Document completion in Maintenance Log.
