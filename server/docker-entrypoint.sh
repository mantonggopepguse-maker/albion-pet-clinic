#!/bin/sh
set -e

echo "=== Albion Pet Clinic Server Entrypoint ==="

# Validate critical env vars
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    exit 1
fi
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-this-to-a-random-secret-in-production" ]; then
    echo "ERROR: JWT_SECRET must be set to a random value in production"
    exit 1
fi

# Run database migrations (non-blocking — don't prevent server from starting)
if [ "${SKIP_MIGRATIONS}" = "true" ]; then
    echo "Skipping Prisma migrations (SKIP_MIGRATIONS=true)"
else
    echo "Running Prisma migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || {
        echo "WARNING: Prisma migrate deploy failed — server will start anyway."
        echo "Run migrations manually if needed."
    }
    echo "Migration step complete."
fi

# Start the application
echo "Starting server on port ${PORT:-8080}..."
exec node dist/index.js
