#!/usr/bin/env bash
# Wake Neon then create + apply a migration.
set -e
NAME="${1:-pending_migration}"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL must be set}"
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "→ waking neon (cold start can take ~5s)…"
for i in $(seq 1 8); do
  if echo "select 1" | PGCONNECT_TIMEOUT=20 psql "$DATABASE_URL" -tA >/dev/null 2>&1; then
    echo "  ✓ awake (try $i)"
    break
  fi
  echo "  retry $i…"
  sleep 5
done

echo "→ generating migration ${NAME}…"
TS=$(date -u +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_${NAME}"
mkdir -p "$DIR"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$DIR/migration.sql"
LINES=$(wc -l < "$DIR/migration.sql")
if [ "$LINES" -lt 2 ]; then
  echo "  (no schema diff — removing empty migration)"
  rm -rf "$DIR"
else
  echo "  wrote $DIR/migration.sql ($LINES lines)"
  head -50 "$DIR/migration.sql"
fi

echo "→ applying pending migrations…"
npx prisma migrate deploy

echo "→ regenerating client…"
npx prisma generate >/dev/null
echo "✓ done"
