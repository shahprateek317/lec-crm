#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

echo "→ wait for redeploy with /my-schedule live"
for i in $(seq 1 36); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL/my-schedule")
  if [ "$code" = "307" ]; then break; fi
  sleep 10
done

CSRF=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

check() {
  local label=$1 url=$2; shift 2
  curl -s -b "$COOKIE" "$url" -o /tmp/ec.html
  echo "=== $label ($url) ==="
  for marker in "$@"; do
    if grep -qiF "$marker" /tmp/ec.html; then echo "  ✓ $marker"; else echo "  ✗ $marker"; fi
  done
}

check "/my-schedule"      "$URL/my-schedule" "My schedule" "Block time off" "Today" "7 days"

curl -s -b "$COOKIE" "$URL/leads" -o /tmp/leads.html
ID=$(grep -oE '/leads/[a-z0-9]{20,}' /tmp/leads.html | head -1 | cut -d/ -f3)
check "/leads/.../visits/new"  "$URL/leads/$ID/visits/new" "Suggested" "Assigned healer"
check "/leads/.../healing/new" "$URL/leads/$ID/healing/new" "Chakra" "Cleansing" "Energising" "Demo" "Paid"

curl -s -b "$COOKIE" "$URL/dashboard" -o /tmp/dash.html
echo ""
echo "=== install prompt JS bundled ==="
grep -oE 'beforeinstallprompt|Install Life|Add to Home Screen' /tmp/dash.html | sort -u | head -5
