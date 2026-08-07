# Deployment Guide

## Continuous Deployment (GitHub Actions)

The repo ships with `.github/workflows/ci.yml` (lint, build, test) and `.github/workflows/deploy.yml` (Docker build → Artifact Registry → Cloud Run, triggered on push to `main` or manual dispatch).

### Required GitHub repo secrets

| Secret | Purpose |
|--------|---------|
| `GCP_SA_KEY` | JSON service-account key with *Cloud Run Admin*, *Artifact Registry Writer*, *Storage Admin* roles |
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | Cloud Run region (e.g. `us-central1`, `sa-east1`) |
| `DATABASE_URL` / `DIRECT_URL` | Prisma connection strings (`?schema=pet_clinic`) |
| `JWT_SECRET` | Server JWT signing secret |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Mail delivery |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | CORS configuration |
| `GEMINI_API_KEY` | Server-side Gemini key |
| `FIREBASE_CONFIG` | Firebase service-account JSON (single-line escaped) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `VITE_GEMINI_API_KEY`, `VITE_FIREBASE_*` | Baked into the frontend at build time (incl. `VITE_FIREBASE_VAPID_KEY`) |

First run: create the Artifact Registry repo once:

```bash
gcloud artifacts repositories create albion-pet-clinic \
  --repository-format=docker --location=sa-east1
```

## Prerequisites
- PostgreSQL 14+ database (Google Cloud SQL recommended)
- Node.js 22+
- Docker (for Cloud Run deployment)

## Environment Variables

### Backend (`server/.env`)
```
DATABASE_URL=postgresql://user:password@host:5432/albion_pet_clinic
DIRECT_URL=postgresql://user:password@host:5432/albion_pet_clinic
JWT_SECRET=<random-64-char-string>
PORT=8080
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
GEMINI_API_KEY=your_gemini_key
FIREBASE_CONFIG=your_firebase_service_account_json
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Frontend (`.env`)
```
VITE_API_URL=/api
VITE_GEMINI_API_KEY=your_gemini_key
```

## Database Setup
1. Create PostgreSQL database: `CREATE DATABASE albion_pet_clinic;`
2. Run migrations: `cd server && npx prisma migrate deploy`
3. Seed data: `cd server && npx tsx prisma/seed.ts`

## Prisma Migration
Migrations run automatically on container startup via `docker-entrypoint.sh`. To run manually:
```bash
cd server
npx prisma migrate deploy
```

## Build & Deploy

### Docker (Cloud Run)
```bash
docker build -t albion-pet-clinic .
docker run -p 8080:8080 albion-pet-clinic
```

### Manual
```bash
# Frontend
npm run build

# Backend
cd server
npx prisma generate
npm run build
npm start
```

## Database Backup
```bash
# Automated daily backup (add to crontab)
pg_dump postgresql://user:password@host:5432/albion_pet_clinic | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20260701.sql.gz | psql postgresql://user:password@host:5432/albion_pet_clinic
```

## File Backup
Uploads are stored in `server/uploads/`. Back up this directory regularly:
```bash
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz server/uploads/
```

## Rollback
1. Revert code to previous version
2. Re-run `npx prisma migrate deploy` (migrations are reversible)
3. Restore database from latest backup if needed
4. Redeploy with `docker build` or rollback Cloud Run revision

## Cloud Run Deployment Checklist
- [ ] Database migrated and seeded
- [ ] Environment variables configured in Cloud Run
- [ ] Secret Manager secrets created (JWT_SECRET, SMTP_PASS)
- [ ] Cloud SQL connection configured
- [ ] Allowed origins configured for CORS
- [ ] Health check endpoint responding at /health
- [ ] Static files served correctly
- [ ] Upload directory writable (/tmp/uploads)
