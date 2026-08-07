# ── Stage 1: Build Frontend ──────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Build-time config — Vite inlines VITE_* values at build time.
# Pass real values with --build-arg (e.g. in CI/CD).
ARG VITE_API_URL=/api
ARG VITE_GEMINI_API_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_VAPID_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID \
    VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY

COPY . .
RUN npm run build

# ── Stage 2: Build Backend ───────────────────────────────────────────
FROM node:22-alpine AS backend-builder
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm install
COPY server/ .
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production Runner ───────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache wget openssl
RUN addgroup --system --gid 1001 albion
RUN adduser --system --uid 1001 albion
WORKDIR /app

# Copy frontend build
COPY --from=frontend-builder /app/dist ./dist

# Copy backend build, node_modules (includes Prisma client), and schema
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/prisma ./server/prisma
COPY --from=backend-builder /app/server/package.json ./server/

# Create uploads directory
RUN mkdir -p /app/server/uploads/receipts /app/server/uploads/temp && \
    chown -R albion:albion /app/server/uploads

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy entrypoint and set permissions before switching to non-root user
COPY server/docker-entrypoint.sh ./server/docker-entrypoint.sh
RUN chmod +x ./server/docker-entrypoint.sh && chown -R albion:albion /app

USER albion

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
