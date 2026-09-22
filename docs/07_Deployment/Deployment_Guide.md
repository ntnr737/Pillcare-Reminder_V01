# PillCare - Production Deployment Guide

## 1. Cloud Infrastructure Overview
- **Backend Service**: GCP Cloud Run (Serverless Python 3.14 container scaling `0 -> 100` instances).
- **Domain Edge & DNS**: Cloudflare CDN (`admin.pillcare.in` routed to `/admin.html`).
- **Mobile Distribution**: Expo EAS Cloud & Google Play Console (Internal/Production Tracks).

---

## 2. GCP Cloud Run Deployment Execution
```bash
# Build and deploy backend container to GCP Cloud Run
gcloud builds submit --tag gcr.io/pillcare-prod/backend:latest backend/
gcloud run deploy pillcare-backend \
  --image gcr.io/pillcare-prod/backend:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

---

## 3. Cloudflare Routing Rules Configuration
1. **CNAME Record**: `admin.pillcare.in` $\rightarrow$ `pillcare.in` (Proxied `ORANGE CLOUD`).
2. **Transform URL Rewrite Rule**:
   - Expression: `(http.host eq "admin.pillcare.in" and http.request.uri.path eq "/")`
   - Rewrite: Dynamic Path `/admin.html`
