#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp)
trap "rm -f $COOKIE" EXIT

echo "→ Wait for fresh deploy (csrf + settings page markers)"
for i in $(seq 1 40); do
  csrf_body=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf")
  if echo "$csrf_body" | grep -q csrfToken; then
    break
  fi
  sleep 8
done
CSRF=$(echo "$csrf_body" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')

echo "→ Sign in as admin"
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null
grep -q authjs.session-token "$COOKIE" || { echo "✗ no session"; exit 1; }

for attempt in $(seq 1 20); do
  html=$(curl -s -b "$COOKIE" "$URL/settings")
  if echo "$html" | grep -qF "WhatsApp Business"; then
    break
  fi
  echo "  (deploy still propagating, retry $attempt)"
  sleep 10
done

echo "=== /settings ==="
for m in "Staff accounts" "Credit packages" "Courses" "WhatsApp Business" "Razorpay" "Demo mode"; do
  echo "$html" | grep -qF "$m" && echo "  ✓ $m" || echo "  ✗ $m"
done

echo "=== /settings/whatsapp ==="
wa=$(curl -s -b "$COOKIE" "$URL/settings/whatsapp")
for m in "Meta Business" "Webhook URL" "Verify Token" "Test connection" "Phone Number ID"; do
  echo "$wa" | grep -qF "$m" && echo "  ✓ $m" || echo "  ✗ $m"
done

echo "=== /settings/razorpay ==="
rp=$(curl -s -b "$COOKIE" "$URL/settings/razorpay")
for m in "Webhook Secret" "Key ID" "Key Secret" "Test connection" "Demo mode"; do
  echo "$rp" | grep -qF "$m" && echo "  ✓ $m" || echo "  ✗ $m"
done
