#!/usr/bin/env bash
# Run during build. Re-seeds the demo data unless the host opts out by
# setting SKIP_SEED=true. Real production deployments where the DB already
# holds live customer data should set SKIP_SEED=true so we don't churn.
set -e
if [ "${SKIP_SEED}" = "true" ]; then
  echo "→ SKIP_SEED=true — skipping demo seed."
  exit 0
fi
echo "→ Running idempotent seed (set SKIP_SEED=true in env to disable)…"
npx tsx prisma/seed.ts
echo "→ Running demo data top-up…"
npx tsx prisma/demo.ts || true
