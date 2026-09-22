# PillCare - Emergency Rollback Procedure

## 1. Backend Service Rollback (GCP Cloud Run)
If a critical regression is detected in production:
```bash
# List previous revisions
gcloud run revisions list --service pillcare-backend --region europe-west1

# Route 100% traffic back to previous stable revision
gcloud run services update-traffic pillcare-backend \
  --to-revisions pillcare-backend-00042-xyz=100 \
  --region europe-west1
```

---

## 2. Play Store Mobile App Rollback Strategy
- Android native apps cannot roll back binary versions directly on Play Store.
- **Hotfix Strategy**: Revert git commit locally, increment `versionCode`, recompile APK/AAB, and publish emergency update track within 2 hours.
