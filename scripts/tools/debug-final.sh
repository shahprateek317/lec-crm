#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

CSRF=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

curl -s -b "$COOKIE" "$URL/leads" -o /tmp/leads.html
CLIENT_ID=$(grep -oE '/leads/[a-z0-9]{20,}' /tmp/leads.html | head -1 | cut -d/ -f3)
echo "client id: $CLIENT_ID"

echo ""
echo "=== counselling new for real client ==="
curl -s -b "$COOKIE" "$URL/leads/$CLIENT_ID/counselling/new" -o /tmp/cn.html
echo "html size: $(wc -c < /tmp/cn.html)"
for m in "Suggested" "Pick a date" "Counsellor" "DateTimePicker"; do
  grep -qF "$m" /tmp/cn.html && echo "  ✓ $m" || echo "  ✗ $m"
done

echo ""
echo "=== Press ⌘K hint search on /dashboard ==="
curl -s -b "$COOKIE" "$URL/dashboard" -o /tmp/dash.html
grep -oE '(Press|⌘K|kbd|to search)' /tmp/dash.html | sort -u | head -8

echo ""
echo "=== Lead score badge presence on /leads ==="
grep -oE '★ [0-9]+' /tmp/leads.html | head -5
echo "(if empty, no scores yet — run sync below)"
