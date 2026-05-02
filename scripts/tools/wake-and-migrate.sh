#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
DB="${DATABASE_URL:?set DATABASE_URL}"

echo "→ wake the live app (which keeps Neon hot via the next request)"
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "  ping %{http_code}\n" "$URL/sign-in"
  sleep 5
done

echo "→ probe Neon directly"
for i in $(seq 1 10); do
  if echo "SELECT 1" | psql "$DB" -tA >/dev/null 2>&1; then
    echo "  ✓ Neon awake"
    break
  fi
  echo "  retry $i…"
  sleep 6
done
