# Albion Pet Clinic — Veterinary Clinic Management System

Multi-branch veterinary practice management platform for Albion Pharmaceuticals (Nigeria). Covers the full clinic workflow: appointments, POS, treatments, surgery, hospitalization, inventory, payments, AI-assisted documentation, and client portal.

## Tech Stack

### Frontend
- React 19, TypeScript, Vite 6
- Tailwind CSS 3, Lucide React (icons), Recharts (charts)
- PWA (Workbox) — offline-capable
- Dexie.js (IndexedDB) for offline sync

### Backend
- Express 4, TypeScript (tsx watch mode)
- Prisma 5 ORM → PostgreSQL 14+
- Zod (input validation), Helmet (security headers)
- JWT auth, bcrypt (password/narcotics PIN hashing)
- Multer (receipt uploads), Nodemailer (email)
- Google Gemini AI API, Firebase Admin SDK

### Testing
- Vitest (planned — test framework available, tests not yet written)

### Deployment
- Docker multi-stage build → Google Cloud Run

## Architecture

Monorepo within a single repository:
```
albion-pet-clinic/
├── src/          # Frontend (React/Vite)
│   ├── components/
│   │   ├── views/        # Page-level views (Dashboard, POS, etc.)
│   │   ├── shared/       # Reusable components (Layout, InvoiceModal, etc.)
│   │   ├── forms/        # Form components
│   │   ├── dashboards/   # Role-specific dashboards
│   │   ├── ai/           # AI-powered features
│   │   └── portal/       # Client portal components
│   ├── services/         # API client, Firebase, Gemini, sync, cache
│   ├── hooks/            # Custom React hooks
│   ├── config/           # Permissions, app config
│   └── types/            # TypeScript definitions
├── server/       # Backend (Express/Prisma)
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── middleware/    # Auth, validation middleware
│   │   └── utils/        # Audit logger, stock movement logger
│   ├── prisma/           # Schema + migrations
│   ├── uploads/          # Receipt upload storage
│   └── types/            # Server-side type definitions
├── Dockerfile
├── DEPLOYMENT.md
└── RELEASE_CHECKLIST.md
```

## Quick Start

```bash
# 1. Install frontend dependencies
cd albion-pet-clinic
npm install

# 2. Install backend dependencies
cd server
npm install
cd ..

# 3. Set up environment
cp .env.example .env          # Frontend env
cp server/.env.example server/.env   # Backend env
# Edit both .env files with your credentials

# 4. Apply database schema (requires PostgreSQL 14+)
cd server
npx prisma generate
npx prisma migrate dev
cd ..

# 5. Start development servers
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
# Frontend runs on http://localhost:5173
# Backend API runs on http://localhost:5000
```

## Environment Variables

### Frontend (`albion-pet-clinic/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | No | Google Gemini API key for AI features |

### Backend (`albion-pet-clinic/server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 7d) |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |
| `GEMINI_API_KEY` | No | Gemini API key for backend AI features |
| `FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | Path to Firebase service account JSON |

## Database

```bash
cd server
npx prisma generate   # Generate Prisma Client
npx prisma migrate dev  # Apply migrations
npx prisma studio       # Open Prisma Studio GUI
```

Schema is defined in `prisma/schema.prisma` (45+ models). Covers:
- Multi-clinic/branch management
- Users, roles, permissions
- Patients, clients, appointments
- Sales, payments (cash, bank transfer, card, check)
- Inventory, stock movements, reconciliation
- Treatments, vaccinations, surgery, hospitalization
- Lab results, narcotics logs, consent forms
- AI transcripts/SOAP notes, chat conversations, FAQ
- Shift scheduling, queue management, referrals
- Audit logging, cash reconciliation, expenses

## Testing

```bash
# Frontend (Vitest)
npm test

# Backend (Vitest)
cd server && npm test
```

Test framework is configured. Tests are pending implementation.

## Security

- All mutation routes validated with Zod schemas
- JWT authentication middleware on protected routes
- Helmet security headers (CORS, HSTS, XSS protection, etc.)
- Narcotics PIN stored as bcrypt hash
- Receipt uploads sanitized and stored server-side
- DOM sanitization on public referral inputs (DOMPurify)
- Audit logging on all financial and auth actions
- Rate limiting on auth endpoints

## Deployment

```bash
# Build Docker image
docker build -t albion-pet-clinic .

# Tag and push to Google Container Registry
docker tag albion-pet-clinic gcr.io/$PROJECT_ID/albion-pet-clinic
docker push gcr.io/$PROJECT_ID/albion-pet-clinic

# Deploy to Cloud Run
gcloud run deploy albion-pet-clinic \
  --image gcr.io/$PROJECT_ID/albion-pet-clinic \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=...,JWT_SECRET=...,NODE_ENV=production"
```

The Dockerfile serves both frontend (built static files) and backend (Express API) from a single container.

See `DEPLOYMENT.md` and `RELEASE_CHECKLIST.md` for detailed deployment and launch instructions.
