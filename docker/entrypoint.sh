#!/usr/bin/env bash
# Runtime entrypoint for the LEC CRM container.
#
# 1. Wait for Postgres to be reachable (compose health-checks already, but
#    belt+braces in case of network blips).
# 2. Apply pending Prisma migrations.
# 3. Run the idempotent seed (set SKIP_SEED=true once you go live with real data).
# 4. Start the Next.js server on $PORT.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set" >&2
  exit 1
fi

echo "→ waiting for database..."
for i in $(seq 1 60); do
  if node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "✓ database reachable"
    break
  fi
  sleep 2
done

echo "→ applying migrations"
prisma migrate deploy

if [ "${SKIP_SEED:-false}" != "true" ]; then
  echo "→ running idempotent seed (set SKIP_SEED=true once you go live)"
  tsx prisma/seed.ts || echo "WARN: seed failed (continuing)"
fi

echo "→ starting Next.js on $HOSTNAME:$PORT"
exec node server.js
