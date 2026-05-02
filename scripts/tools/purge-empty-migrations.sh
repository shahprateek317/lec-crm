#!/usr/bin/env bash
# Hard cleanup: drop the _prisma_migrations rows for healing_form_v2 stubs
# AND remove their directories. Keeps the most recent (the one with actual
# SQL, if any) — anything earlier with 0-byte migration.sql gets purged.
set -e
cd "$(dirname "$0")/../.."

# Delete rows that we know are empty stubs.
echo "→ purging _prisma_migrations stubs"
echo "DELETE FROM _prisma_migrations WHERE migration_name IN (
  '20260502063327_healing_form_v2',
  '20260502063604_healing_form_v2',
  '20260502063653_healing_form_v2',
  '20260502063958_healing_form_v2',
  '20260502064053_healing_form_v2',
  '20260502064233_healing_form_v2',
  '20260502064526_healing_form_v2'
);" | PGCONNECT_TIMEOUT=15 psql "$DATABASE_URL" 2>&1 | tail -3

echo "→ removing empty directories"
for d in 20260502063327_healing_form_v2 20260502063604_healing_form_v2 \
         20260502063653_healing_form_v2 20260502063958_healing_form_v2 \
         20260502064053_healing_form_v2 20260502064233_healing_form_v2 \
         20260502064526_healing_form_v2; do
  rm -rf "prisma/migrations/$d"
  echo "  removed $d"
done
echo "✓ done"
