#!/usr/bin/env bash
# E2E sign-in check. Fails with nonzero exit if the admin dashboard doesn't
# render the "Set up your centre" onboarding section.
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

echo "→ Wait for csrf to return JSON (deploy live)"
for _ in $(seq 1 40); do
  body=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf")
  if echo "$body" | grep -q csrfToken; then break; fi
  sleep 5
done
CSRF=$(echo "$body" | python3 -c "import json,sys;print(json.load(sys.stdin)['csrfToken'])")
echo "✓ csrf=$CSRF"

echo "→ Sign in as admin@lec.app / demo1234"
curl -s -b "$COOKIE" -c "$COOKIE" \
  -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

if ! grep -q authjs.session-token "$COOKIE"; then
  echo "✗ no session cookie set"; exit 1
fi
echo "✓ session cookie stored"

echo "→ Fetch /dashboard as admin"
html=$(curl -s -b "$COOKIE" "$URL/dashboard")
for marker in "Welcome," "Admin view" "Set up your centre" "Staff accounts" "Credit packages"; do
  if echo "$html" | grep -qF "$marker"; then
    echo "  ✓ '$marker'"
  else
    echo "  ✗ '$marker' MISSING"
  fi
done
