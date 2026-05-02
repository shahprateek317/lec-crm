#!/usr/bin/env bash
# Force Neon to wake by triggering a real DB query through the live app.
set -e
URL="${URL:-https://lec-crm.vercel.app}"
DB="${DATABASE_URL:?set DATABASE_URL}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

echo "→ Sign in (queries User table → wakes Neon)"
CSRF=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

echo "→ Hit /dashboard (full Prisma load)"
curl -s -b "$COOKIE" "$URL/dashboard" -o /dev/null -w "  status %{http_code}\n"

echo "→ Now probe psql"
for i in $(seq 1 10); do
  if echo "SELECT 1" | psql "$DB" -tA >/dev/null 2>&1; then
    echo "  ✓ Neon awake"
    exit 0
  fi
  sleep 5
done
echo "  ✗ Still cold"
exit 1
