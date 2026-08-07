## Beta Release Checklist

### Database
- [ ] Run `npx prisma migrate deploy` on production DB
- [ ] Run `npx tsx prisma/seed.ts` if first deployment
- [ ] Verify all new models exist (StockMovement, CashReconciliation)
- [ ] Verify Payment model has new fields (receiptUrl, status, verifiedBy, etc.)

### Backend
- [ ] `npm run build` succeeds with no errors
- [ ] All Zod schemas are in place for POST/PUT endpoints
- [ ] JWT_SECRET is a random 64-char string (not default)
- [ ] CORS `ALLOWED_ORIGINS` matches frontend domain
- [ ] Upload directory (`/tmp/uploads` or persistent volume) is writable

### Frontend
- [ ] `npm run build` succeeds (2864 modules, ~4.5MB)
- [ ] Service worker generated (PWA enabled)
- [ ] Environment variables set (`VITE_API_URL=/api`)

### Verification (run against staging)
- [ ] Admin can register new staff users via `/api/auth/register`
- [ ] Invoice payment with Cash/Card creates completed payment immediately
- [ ] Invoice payment with Bank Transfer creates pending_verification payment
- [ ] Admin can upload receipt for a pending payment
- [ ] Admin can verify/reject pending payments
- [ ] Verified payment updates sale amountPaid and balanceDue
- [ ] Rejected payment refunds amount and sets sale back to Pending
- [ ] Cash reconciliation flow works (record → reconcile)
- [ ] Stock movements logged on sale, restock, reconciliation, void
- [ ] `GET /api/inventory/:id/movements` returns movement history

### Rollback Plan
- Database: Revert migration via `prisma migrate down` or restore from backup
- Code: Revert to previous commit and redeploy
- Uploads: Files remain in uploads directory after rollback

---

## Production Launch Checklist

### Pre-Launch (1 week before)
- [ ] Load test with k6/artillery on `/api/sales`, `/api/inventory`
- [ ] Set up Cloud SQL with automated backups (daily pg_dump)
- [ ] Set up uptime monitoring (Pingdom, UptimeRobot, or GCP Monitoring)
- [ ] Set up error tracking (Sentry for backend, Sentry for frontend)
- [ ] Configure Cloud Run autoscaling (min 1, max 10, concurrency 80)
- [ ] Set up custom domain + SSL certificate
- [ ] Create secrets in Secret Manager: JWT_SECRET, SMTP_PASS, GEMINI_API_KEY
- [ ] Test SMTP (password reset, invitation emails)
- [ ] Verify file uploads work correctly in Cloud Run (use /tmp/uploads or GCS)

### Launch Day
- [ ] Final `npm run build` on main branch
- [ ] Deploy to staging, run full verification suite
- [ ] Deploy to production
- [ ] Verify health endpoint returns 200
- [ ] Smoke test: login → create sale → record payment → verify receipt
- [ ] Verify PWA loads correctly on mobile device
- [ ] Monitor error rates and latency for first hour
- [ ] Send beta announcement to existing clinics

### Post-Launch (first week)
- [ ] Monitor database connection pool under load
- [ ] Watch for slow queries in Prisma logs
- [ ] Check file upload sizes and storage usage
- [ ] Verify backup cron job is running (daily by default)
- [ ] Collect user feedback on payment verification workflow
- [ ] Review audit logs for any anomalies
