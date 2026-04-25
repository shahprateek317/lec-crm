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

echo "=== /settings/users ==="
curl -s -b "$COOKIE" "$URL/settings/users" -o /tmp/staff.html
for m in "Add staff member" "Healer" "Counsellor" "Coordinator" "Filter"; do
  grep -qF "$m" /tmp/staff.html && echo "  ✓ $m" || echo "  ✗ $m"
done

# Walk every user link, fetch detail, check that the appropriate role
# section renders.
for ID in $(grep -oE 'href="/settings/users/[a-z0-9]+"' /tmp/staff.html | sed 's|href="/settings/users/||;s|"||' | sort -u); do
  curl -s -b "$COOKIE" "$URL/settings/users/$ID" -o /tmp/u.html
  ROLE=$(grep -oE '"text-sm text-muted-foreground">[^<]*' /tmp/u.html | head -1 | cut -d'>' -f2)
  echo ""
  echo "=== /settings/users/$ID ($ROLE) ==="
  for m in "Basic details" "Coming later" "Reset password" "Activity at a glance" "Save changes"; do
    grep -qF "$m" /tmp/u.html && echo "  ✓ $m" || echo "  ✗ $m"
  done
  for m in "Healer profile" "Counsellor profile" "Coordinator profile" "Admin permissions"; do
    if grep -qF "$m" /tmp/u.html; then echo "  → role section: $m"; fi
  done
done
