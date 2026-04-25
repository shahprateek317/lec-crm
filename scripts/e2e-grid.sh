#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

echo "→ Wait for redeploy"
for i in $(seq 1 30); do
  if curl -s "$URL/sign-in" | grep -q one-tap; then break; fi
  sleep 8
done

CSRF=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

curl -s -b "$COOKIE" "$URL/settings/users?role=HEALER" -o /tmp/staff.html
HEALER_ID=$(grep -oE "/settings/users/[a-z0-9]+" /tmp/staff.html | head -1 | cut -d/ -f4)
echo "healer id: $HEALER_ID"

for i in $(seq 1 12); do
  HTML=$(curl -s -b "$COOKIE" "$URL/settings/users/$HEALER_ID")
  if echo "$HTML" | grep -q "Weekly availability"; then
    echo "✓ grid label live"
    break
  fi
  echo "  retry $i — waiting for redeploy"
  sleep 10
done

echo ""
echo "=== sample data-slot cells ==="
echo "$HTML" | grep -oE 'data-slot="[A-Z]+:[A-Z_]+"' | sort -u | head -8
TOTAL=$(echo "$HTML" | grep -oE "data-slot=" | wc -l)
SELECTED=$(echo "$HTML" | grep -oE 'aria-pressed="true"' | wc -l)
echo ""
echo "total cells in HTML: $TOTAL (expect 35)"
echo "pre-selected cells:  $SELECTED (expect 13 for healer demo)"

# Check that the AvailabilityGrid component is being hydrated (look for its hidden inputs)
HIDDEN=$(echo "$HTML" | grep -oE 'name="availabilitySlots"' | wc -l)
echo "hidden slot inputs:  $HIDDEN (expect 13)"
