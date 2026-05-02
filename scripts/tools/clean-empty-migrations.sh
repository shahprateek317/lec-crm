#!/usr/bin/env bash
# Remove migration directories whose migration.sql is empty AND whose name
# isn't recorded in the _prisma_migrations table. Safer than rm -rf:
# only touches dirs the DB hasn't tracked.
set -e
cd "$(dirname "$0")/../.."

applied=$(echo "select migration_name from _prisma_migrations" |
  PGCONNECT_TIMEOUT=15 psql "$DATABASE_URL" -tA 2>/dev/null || true)

removed=0
for dir in prisma/migrations/*/; do
  name=$(basename "$dir")
  sql="${dir}migration.sql"
  if [ ! -s "$sql" ]; then
    if echo "$applied" | grep -qx "$name"; then
      echo "  ⚠ $name has empty SQL but is recorded — leaving alone"
    else
      echo "  ✗ removing empty + untracked $name"
      rm -rf "$dir"
      removed=$((removed + 1))
    fi
  fi
done
echo "✓ removed $removed dirs"
