#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?missing migration name}"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"
TS=$(date -u +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_${NAME}"
mkdir -p "$DIR"
npx prisma migrate diff \
  --from-url "$DB_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$DIR/migration.sql"
echo "=== $DIR/migration.sql ==="
wc -l "$DIR/migration.sql"
head -50 "$DIR/migration.sql"
echo "..."
echo "(rest hidden — apply with npx prisma migrate deploy)"
